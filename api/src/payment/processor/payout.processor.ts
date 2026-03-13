import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TransactionType } from '@zevento/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PayoutService } from '../payout.service';

/**
 * PayoutProcessor: BullMQ worker for the 'vendor-payout' queue.
 *
 * Executes vendor payouts only when booking is COMPLETED (defense in depth).
 * The payout job is enqueued by BookingService.transitionStatus on COMPLETED transition.
 *
 * Flow:
 *   1. Verify booking is COMPLETED (throw to retry if not yet transitioned)
 *   2. Call PayoutService.createPayout (handles bank detail checks and dev mock mode)
 *   3. Update Transaction with razorpayPayoutId and payoutStatus
 *
 * BullMQ retries with exponential backoff (60s base, 5 attempts).
 */
@Processor('vendor-payout')
@Injectable()
export class PayoutProcessor extends WorkerHost {
  private readonly logger = new Logger(PayoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutService: PayoutService,
  ) {
    super();
  }

  async process(
    job: Job<{
      bookingId: string;
      vendorId: string;
      netPayoutPaise: number;
      razorpayPaymentId: string;
    }>,
  ): Promise<void> {
    const { bookingId, vendorId, netPayoutPaise, razorpayPaymentId } =
      job.data;

    this.logger.log(
      `Processing vendor payout: bookingId=${bookingId}, vendorId=${vendorId}, amount=${netPayoutPaise}`,
    );

    // 1. Verify booking is COMPLETED (defense in depth)
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      this.logger.error(`Booking ${bookingId} not found for payout`);
      return;
    }

    if (booking.status !== 'COMPLETED') {
      // Booking not yet completed -- throw to trigger BullMQ retry with backoff
      // This handles the race condition where payout job fires before booking transitions
      this.logger.warn(
        `Booking ${bookingId} status is ${booking.status}, not COMPLETED. Retrying...`,
      );
      throw new Error(
        `Booking ${bookingId} is not COMPLETED (current: ${booking.status}). Will retry.`,
      );
    }

    // 2. Execute payout via PayoutService
    const result = await this.payoutService.createPayout({
      bookingId,
      vendorId,
      netPayoutPaise,
      razorpayPaymentId,
    });

    // 3. Update Transaction with payout details
    if (result.status !== 'PENDING_BANK_DETAILS') {
      await this.prisma.transaction.updateMany({
        where: {
          bookingId,
          type: TransactionType.BOOKING_COMMISSION,
        },
        data: {
          razorpayPayoutId: result.id,
          payoutStatus:
            result.status === 'processing' ? 'PROCESSING' : 'QUEUED',
        },
      });
    }

    this.logger.log(
      `Vendor payout ${result.status}: bookingId=${bookingId}, payoutId=${result.id}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Vendor payout job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? '?'}): ${error.message}`,
      error.stack,
    );
  }
}
