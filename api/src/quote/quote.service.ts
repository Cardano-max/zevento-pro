import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('quote-expiry') private readonly quoteExpiryQueue: Queue,
  ) {}

  /**
   * createOrUpdateQuote: Vendor creates or updates a DRAFT quote for a lead.
   *
   * Upsert logic:
   * - If no quote exists: create in DRAFT status
   * - If DRAFT exists: replace line items and update fields
   * - If SUBMITTED/ACCEPTED/etc: throw BadRequestException (immutable)
   *
   * totalPaise is computed from lineItems DTO, not trusted from client.
   */
  async createOrUpdateQuote(
    leadId: string,
    vendorId: string,
    dto: CreateQuoteDto,
  ) {
    // Calculate total from line items (each quantity defaults to 1 if omitted)
    const totalPaise = dto.lineItems.reduce(
      (sum, item) => sum + item.amountPaise * (item.quantity ?? 1),
      0,
    );

    // Check if a quote already exists for this (leadId, vendorId) pair
    const existingQuote = await this.prisma.quote.findUnique({
      where: { leadId_vendorId: { leadId, vendorId } },
    });

    if (existingQuote) {
      if (existingQuote.status !== 'DRAFT') {
        throw new BadRequestException(
          'Quote already submitted — cannot edit',
        );
      }

      // DRAFT exists: delete old line items and update quote
      await this.prisma.$transaction(async (tx) => {
        await tx.quoteLineItem.deleteMany({
          where: { quoteId: existingQuote.id },
        });

        await tx.quote.update({
          where: { id: existingQuote.id },
          data: {
            totalPaise,
            validUntil: dto.validUntil,
            note: dto.note ?? null,
            lineItems: {
              create: dto.lineItems.map((item) => ({
                description: item.description,
                amountPaise: item.amountPaise,
                quantity: item.quantity ?? 1,
              })),
            },
          },
        });
      });

      return this.prisma.quote.findUnique({
        where: { id: existingQuote.id },
        include: { lineItems: true },
      });
    }

    // No existing quote: create fresh DRAFT
    return this.prisma.quote.create({
      data: {
        leadId,
        vendorId,
        status: 'DRAFT',
        totalPaise,
        validUntil: dto.validUntil,
        note: dto.note ?? null,
        lineItems: {
          create: dto.lineItems.map((item) => ({
            description: item.description,
            amountPaise: item.amountPaise,
            quantity: item.quantity ?? 1,
          })),
        },
      },
      include: { lineItems: true },
    });
  }

  /**
   * submitQuote: Transition quote from DRAFT → SUBMITTED.
   *
   * Atomic state transition using updateMany with status filter (TOCTOU-safe).
   * Updates Lead.status to QUOTES_RECEIVED when this is the first submitted quote.
   * Enqueues a BullMQ delayed job for automatic expiry at validUntil.
   */
  async submitQuote(quoteId: string, vendorId: string) {
    const quote = await this.prisma.$transaction(async (tx) => {
      // Atomic DRAFT → SUBMITTED transition
      const updated = await tx.quote.updateMany({
        where: { id: quoteId, vendorId, status: 'DRAFT' },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          'Quote not found, not in DRAFT status, or does not belong to this vendor',
        );
      }

      // Fetch updated quote to get leadId and validUntil
      const q = await tx.quote.findUnique({
        where: { id: quoteId },
        include: { lineItems: true },
      });

      if (!q) {
        throw new BadRequestException('Quote not found after update');
      }

      // Check if this is the FIRST submitted quote for the lead
      // (count SUBMITTED quotes excluding this one)
      const submittedCount = await tx.quote.count({
        where: {
          leadId: q.leadId,
          status: 'SUBMITTED',
          id: { not: quoteId },
        },
      });

      if (submittedCount === 0) {
        // First submission: update lead status to QUOTES_RECEIVED
        await tx.lead.update({
          where: { id: q.leadId },
          data: { status: 'QUOTES_RECEIVED' },
        });
        this.logger.log(
          `Lead ${q.leadId} status → QUOTES_RECEIVED (first quote submitted)`,
        );
      }

      return q;
    });

    // Enqueue BullMQ delayed expiry job (outside TX to avoid long-running transaction)
    const delayMs = Math.max(0, quote.validUntil.getTime() - Date.now());
    await this.quoteExpiryQueue.add(
      'expire-quote',
      { quoteId: quote.id },
      {
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(
      `Quote ${quoteId} submitted — expiry job enqueued with delay ${delayMs}ms`,
    );

    return quote;
  }

  /**
   * acceptQuote: Customer accepts one quote, creating a Booking.
   *
   * Atomic transaction:
   * 1. Mark accepted quote as ACCEPTED
   * 2. Verify the lead belongs to the customer
   * 3. Reject all other SUBMITTED quotes for this lead
   * 4. Create Booking record
   * 5. Create initial BookingStatusHistory entry
   * 6. Update Lead.status to BOOKED
   *
   * VendorStats.totalLeadsWon incremented outside TX (avoid long-running TX).
   */
  async acceptQuote(quoteId: string, customerId: string) {
    const booking = await this.prisma.$transaction(async (tx) => {
      // 1. Atomic SUBMITTED → ACCEPTED transition
      const updated = await tx.quote.updateMany({
        where: { id: quoteId, status: 'SUBMITTED' },
        data: { status: 'ACCEPTED' },
      });

      if (updated.count === 0) {
        throw new BadRequestException(
          'Quote not found or not in SUBMITTED status',
        );
      }

      // 2. Fetch accepted quote with lead to verify ownership
      const acceptedQuote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: { lead: true },
      });

      if (!acceptedQuote) {
        throw new BadRequestException('Quote not found after update');
      }

      // 3. Verify the lead belongs to this customer
      if (acceptedQuote.lead.customerId !== customerId) {
        throw new ForbiddenException(
          'This lead does not belong to you',
        );
      }

      // 4. Reject all other SUBMITTED quotes for this lead
      await tx.quote.updateMany({
        where: {
          leadId: acceptedQuote.leadId,
          id: { not: quoteId },
          status: 'SUBMITTED',
        },
        data: { status: 'REJECTED' },
      });

      // 5. Create Booking
      const newBooking = await tx.booking.create({
        data: {
          leadId: acceptedQuote.leadId,
          quoteId,
          customerId,
          vendorId: acceptedQuote.vendorId,
          status: 'BOOKED',
        },
      });

      // 6. Create initial BookingStatusHistory
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: newBooking.id,
          fromStatus: null,
          toStatus: 'BOOKED',
        },
      });

      // 7. Update Lead.status to BOOKED
      await tx.lead.update({
        where: { id: acceptedQuote.leadId },
        data: { status: 'BOOKED' },
      });

      this.logger.log(
        `Quote ${quoteId} accepted — Booking ${newBooking.id} created for Lead ${acceptedQuote.leadId}`,
      );

      return newBooking;
    });

    // Increment VendorStats.totalLeadsWon outside TX (avoid long-running transaction)
    const acceptedQuote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { vendorId: true },
    });

    if (acceptedQuote) {
      await this.prisma.vendorStats.update({
        where: { vendorId: acceptedQuote.vendorId },
        data: { totalLeadsWon: { increment: 1 } },
      });
      this.logger.log(
        `VendorStats.totalLeadsWon incremented for vendor ${acceptedQuote.vendorId}`,
      );
    }

    return booking;
  }

  /**
   * getQuotesForLead: Customer views all SUBMITTED quotes for comparison.
   *
   * Verifies the lead belongs to the customer before returning quotes.
   * Returns quotes ordered by totalPaise ascending (cheapest first).
   */
  async getQuotesForLead(leadId: string, customerId: string) {
    // Verify the lead belongs to this customer
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { customerId: true },
    });

    if (!lead) {
      throw new BadRequestException('Lead not found');
    }

    if (lead.customerId !== customerId) {
      throw new ForbiddenException('This lead does not belong to you');
    }

    // Return SUBMITTED quotes with line items and vendor business name
    return this.prisma.quote.findMany({
      where: { leadId, status: 'SUBMITTED' },
      include: {
        lineItems: true,
        vendor: {
          select: { businessName: true },
        },
      },
      orderBy: { totalPaise: 'asc' },
    });
  }
}
