import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEAD_ROUTING_QUEUE,
  ROUTE_LEAD_JOB,
} from '../routing/routing.constants';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { LeadResponseDto } from './dto/lead-response.dto';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(LEAD_ROUTING_QUEUE) private readonly routingQueue: Queue,
  ) {}

  /**
   * Create a lead inquiry, gated by explicit consent (DPDP Act / PRIV-02).
   *
   * Flow:
   *  1. Verify consentGiven === true
   *  2. Resolve city to Market record (lat/lng)
   *  3. If targetVendorId (Mode A): verify vendor exists, is approved, has active subscription
   *  4. Record consent log (LEAD_CREATION / GRANTED)
   *  5. Create Lead record with PENDING status
   *  6. Return immediate acknowledgment
   *
   * NOTE: BullMQ enqueue will be added in Plan 03-03.
   */
  async createInquiry(
    customerId: string,
    dto: CreateInquiryDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LeadResponseDto> {
    // 1. Consent gate
    if (!dto.consentGiven) {
      throw new BadRequestException(
        'Consent is required to submit an inquiry',
      );
    }

    // 2. Validate: either targetVendorId or categoryId must be present (not both, not neither)
    if (!dto.targetVendorId && !dto.categoryId) {
      throw new BadRequestException(
        'Either targetVendorId or categoryId must be provided',
      );
    }
    if (dto.targetVendorId && dto.categoryId) {
      throw new BadRequestException(
        'Provide either targetVendorId or categoryId, not both',
      );
    }

    // 3. Resolve city to Market
    const market = await this.prisma.market.findFirst({
      where: { city: { equals: dto.city, mode: 'insensitive' } },
    });

    if (!market) {
      throw new BadRequestException("We don't serve this city yet");
    }

    // 4. Mode A: verify target vendor
    if (dto.targetVendorId) {
      const vendor = await this.prisma.vendorProfile.findUnique({
        where: { id: dto.targetVendorId },
        include: { subscription: true },
      });

      if (!vendor || vendor.status !== 'APPROVED') {
        throw new NotFoundException('Vendor not found or not approved');
      }

      if (
        !vendor.subscription ||
        !['ACTIVE', 'AUTHENTICATED'].includes(vendor.subscription.status)
      ) {
        throw new NotFoundException(
          'Vendor does not have an active subscription',
        );
      }
    }

    // 5. Record consent (append-only LEAD_CREATION entry)
    const consentLog = await this.prisma.consentLog.create({
      data: {
        userId: customerId,
        consentType: 'LEAD_CREATION',
        status: 'GRANTED',
        ipAddress,
        userAgent,
      },
    });

    // 6. Create Lead record
    const lead = await this.prisma.lead.create({
      data: {
        customerId,
        eventType: dto.eventType,
        eventDate: new Date(dto.eventDate),
        city: dto.city,
        latitude: market.latitude,
        longitude: market.longitude,
        budget: dto.budget,
        guestCount: dto.guestCount,
        targetVendorId: dto.targetVendorId ?? null,
        categoryId: dto.categoryId ?? null,
        status: 'PENDING',
        consentLogId: consentLog.id,
      },
    });

    // 7. Enqueue async routing job
    const mode = dto.targetVendorId ? 'A' : 'B';
    await this.routingQueue.add(
      ROUTE_LEAD_JOB,
      { leadId: lead.id, mode },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(
      `Lead created: ${lead.id}, mode=${mode}, city=${dto.city} — routing job enqueued`,
    );

    return {
      leadId: lead.id,
      status: 'PENDING',
      message:
        'Your inquiry has been received. We are matching you with the best vendors.',
      createdAt: lead.createdAt,
    };
  }

  /**
   * Get paginated list of a customer's inquiries with assignment details.
   */
  async getMyInquiries(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where: { customerId },
        include: {
          category: { select: { name: true, slug: true } },
          targetVendor: { select: { businessName: true } },
          assignments: {
            select: {
              id: true,
              score: true,
              status: true,
              vendor: { select: { businessName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lead.count({ where: { customerId } }),
    ]);

    return {
      data: leads.map((lead) => ({
        id: lead.id,
        eventType: lead.eventType,
        eventDate: lead.eventDate,
        city: lead.city,
        budget: lead.budget,
        guestCount: lead.guestCount,
        status: lead.status,
        category: lead.category,
        targetVendor: lead.targetVendor
          ? { businessName: lead.targetVendor.businessName }
          : null,
        assignments: lead.assignments.map((a) => ({
          id: a.id,
          vendorName: a.vendor.businessName,
          score: a.score,
          status: a.status,
        })),
        createdAt: lead.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
