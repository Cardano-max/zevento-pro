import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlockDateDto } from './dto/block-date.dto';
import { TransitionStatusDto } from './dto/transition-status.dto';

/**
 * Push message map — title/body for each Booking status transition.
 * Used by transitionStatus to send a push to the customer after every change.
 */
const BOOKING_PUSH_MESSAGES: Record<string, { title: string; body: string }> =
  {
    BOOKED: { title: 'Booking Confirmed', body: 'Your booking has been confirmed.' },
    IN_PROGRESS: { title: 'Event in Progress', body: 'Your vendor is on the way.' },
    COMPLETED: { title: 'Event Completed', body: 'How did it go? Leave a review.' },
    CANCELLED: { title: 'Booking Cancelled', body: 'Your booking has been cancelled.' },
  };

/**
 * Valid status transitions for a Booking:
 * BOOKED → IN_PROGRESS | CANCELLED
 * IN_PROGRESS → COMPLETED | CANCELLED
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  BOOKED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
};

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * transitionStatus: Advance booking through its lifecycle state machine.
   *
   * Valid transitions:
   *   BOOKED → IN_PROGRESS | CANCELLED
   *   IN_PROGRESS → COMPLETED | CANCELLED
   *
   * Uses prisma.$transaction with updateMany (status-filter) to prevent TOCTOU races.
   * Sends a push notification to the customer after every successful transition.
   *
   * @param bookingId - Booking to transition
   * @param requesterId - JWT userId of the requester
   * @param requesterRole - JWT activeRole of the requester
   * @param dto - Target status (and optional cancellation note)
   */
  async transitionStatus(
    bookingId: string,
    requesterId: string,
    requesterRole: string,
    dto: TransitionStatusDto,
  ) {
    // Fetch booking to validate ownership and current status
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    // Authorization check: vendor can only update their own bookings; customer theirs
    if (requesterRole === 'VENDOR' || requesterRole === 'PLANNER' || requesterRole === 'SUPPLIER') {
      // Vendor role: resolve vendorId from userId and compare
      const vendor = await this.prisma.vendorProfile.findUnique({
        where: { userId: requesterId },
        select: { id: true },
      });
      if (!vendor || vendor.id !== booking.vendorId) {
        throw new ForbiddenException('You are not the vendor for this booking');
      }
    } else if (requesterRole === 'CUSTOMER') {
      if (booking.customerId !== requesterId) {
        throw new ForbiddenException('You are not the customer for this booking');
      }
    } else {
      throw new ForbiddenException('Insufficient role to transition booking status');
    }

    // Validate the requested status transition
    const allowedNext = VALID_TRANSITIONS[booking.status] ?? [];
    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition booking from ${booking.status} to ${dto.status}. ` +
          `Allowed transitions: ${allowedNext.join(', ') || 'none'}`,
      );
    }

    const currentStatus = booking.status;

    // Atomic $transaction: updateMany with status filter prevents concurrent transitions
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.updateMany({
        where: { id: bookingId, status: currentStatus },
        data: {
          status: dto.status,
          completedAt: dto.status === 'COMPLETED' ? new Date() : undefined,
          cancelledAt: dto.status === 'CANCELLED' ? new Date() : undefined,
          cancellationNote: dto.status === 'CANCELLED' ? (dto.note ?? undefined) : undefined,
        },
      });

      if (updated.count === 0) {
        // Another request already changed the status — concurrent transition conflict
        throw new BadRequestException(
          `Booking status conflict: expected ${currentStatus}, booking may have already transitioned`,
        );
      }

      // Record status transition in history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: currentStatus,
          toStatus: dto.status,
          note: dto.note ?? null,
        },
      });

      // If completing: mark the lead as COMPLETED
      if (dto.status === 'COMPLETED') {
        await tx.lead.update({
          where: { id: booking.leadId },
          data: { status: 'COMPLETED' },
        });
      }
    });

    // Send push notification to customer after successful transition
    const pushMessage = BOOKING_PUSH_MESSAGES[dto.status];
    if (pushMessage) {
      await this.notificationService.sendPushToCustomer(booking.customerId, {
        title: pushMessage.title,
        body: pushMessage.body,
        data: { bookingId, type: 'BOOKING_STATUS' },
      });
    }

    this.logger.log(
      `Booking ${bookingId}: ${currentStatus} → ${dto.status} by ${requesterRole} ${requesterId}`,
    );

    // Return the updated booking
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { statusHistory: { orderBy: { changedAt: 'desc' } } },
    });
  }

  /**
   * getBooking: Fetch a booking with its full details.
   * Only the customer or vendor of the booking can access this.
   */
  async getBooking(bookingId: string, requesterId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        statusHistory: { orderBy: { changedAt: 'desc' } },
        quote: {
          include: { lineItems: true },
        },
        vendor: { select: { id: true, businessName: true } },
        customer: { select: { id: true, name: true } },
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    // Authorization: only customer or vendor can view
    if (booking.customerId !== requesterId && booking.vendorId !== booking.vendorId) {
      // Need to also check by vendorProfile.userId
      const vendor = await this.prisma.vendorProfile.findUnique({
        where: { userId: requesterId },
        select: { id: true },
      });
      if (!vendor || vendor.id !== booking.vendorId) {
        if (booking.customerId !== requesterId) {
          throw new ForbiddenException('Access denied: not your booking');
        }
      }
    }

    return booking;
  }

  /**
   * blockDate: Block a calendar date for a vendor.
   * Uses @db.Date (no time component). @@unique([vendorId, date]) prevents duplicates.
   */
  async blockDate(vendorId: string, dto: BlockDateDto) {
    try {
      const blocked = await this.prisma.blockedDate.create({
        data: {
          vendorId,
          date: new Date(dto.date),
          reason: dto.reason ?? null,
        },
      });
      return blocked;
    } catch (error: any) {
      // P2002 = unique constraint violation
      if (error?.code === 'P2002') {
        throw new ConflictException(`Date ${dto.date} is already blocked`);
      }
      throw error;
    }
  }

  /**
   * unblockDate: Remove a blocked calendar date for a vendor.
   */
  async unblockDate(vendorId: string, date: string) {
    const result = await this.prisma.blockedDate.deleteMany({
      where: { vendorId, date: new Date(date) },
    });
    return { deleted: result.count };
  }

  /**
   * getVendorCalendar: Return blocked dates and booking dates for a vendor's month.
   * Returns ISO date strings (YYYY-MM-DD) for client rendering.
   */
  async getVendorCalendar(vendorId: string, year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0); // Last day of month

    const [blockedDates, bookings] = await Promise.all([
      this.prisma.blockedDate.findMany({
        where: {
          vendorId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { date: true },
      }),
      this.prisma.booking.findMany({
        where: {
          vendorId,
          status: { in: ['BOOKED', 'IN_PROGRESS'] },
          lead: {
            eventDate: { gte: startOfMonth, lte: endOfMonth },
          },
        },
        include: {
          lead: { select: { eventDate: true } },
        },
      }),
    ]);

    const toDateString = (d: Date) => d.toISOString().split('T')[0];

    return {
      blockedDates: blockedDates.map((b) => toDateString(b.date)),
      bookingDates: bookings.map((b) => toDateString(b.lead.eventDate)),
    };
  }

  /**
   * getVendorEarnings: Compute earnings dashboard metrics for a vendor.
   * Aggregates: leadsReceived, leadsWon, completedBookings, totalEarningsPaise.
   */
  async getVendorEarnings(vendorId: string) {
    const [stats, completedBookings, completedBookingsList] = await Promise.all([
      this.prisma.vendorStats.findUnique({
        where: { vendorId },
        select: { totalLeadsReceived: true, totalLeadsWon: true },
      }),
      this.prisma.booking.count({
        where: { vendorId, status: 'COMPLETED' },
      }),
      this.prisma.booking.findMany({
        where: { vendorId, status: 'COMPLETED' },
        include: { quote: { select: { totalPaise: true } } },
      }),
    ]);

    const totalEarningsPaise = completedBookingsList.reduce(
      (sum, b) => sum + (b.quote?.totalPaise ?? 0),
      0,
    );

    return {
      leadsReceived: stats?.totalLeadsReceived ?? 0,
      leadsWon: stats?.totalLeadsWon ?? 0,
      completedBookings,
      totalEarningsPaise,
    };
  }
}
