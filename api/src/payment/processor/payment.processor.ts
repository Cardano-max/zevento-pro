import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TransactionType, TransactionStatus, WebhookEventStatus } from '@zevento/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionService } from '../commission.service';

/**
 * PaymentProcessor: BullMQ worker for the 'payment-processing' queue.
 *
 * Processes payment.captured events asynchronously:
 *   1. Find booking by razorpayOrderId
 *   2. Calculate commission split using locked rate (or fallback to CommissionService)
 *   3. Create BOOKING_COMMISSION Transaction with commission and net payout amounts
 *   4. Update booking paymentStatus to CAPTURED
 *   5. Mark webhookEvent as PROCESSED
 *
 * Commission is NOT calculated in the webhook handler (async processing via BullMQ).
 * Transaction creation happens here, not in PaymentWebhookService (source of truth).
 */
@Processor('payment-processing')
@Injectable()
export class PaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
  ) {
    super();
  }

  async process(
    job: Job<{
      webhookEventId: string;
      paymentEntity: any;
      orderNotes: Record<string, any>;
    }>,
  ): Promise<void> {
    const { webhookEventId, paymentEntity, orderNotes } = job.data;

    this.logger.log(
      `Processing payment captured: paymentId=${paymentEntity.id}, orderId=${paymentEntity.order_id}`,
    );

    // 1. Find booking by razorpayOrderId
    const booking = await this.prisma.booking.findFirst({
      where: { razorpayOrderId: paymentEntity.order_id },
      include: {
        lead: { select: { categoryId: true } },
      },
    });

    if (!booking) {
      this.logger.error(
        `No booking found for order ${paymentEntity.order_id}. Marking webhook as FAILED.`,
      );
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: WebhookEventStatus.FAILED },
      });
      return;
    }

    // 2. Get commission rate: prefer locked rate on booking, fall back to CommissionService
    let commissionRateBps = booking.commissionRateBps;
    if (commissionRateBps == null) {
      this.logger.warn(
        `Booking ${booking.id} has no locked commission rate. Falling back to CommissionService.`,
      );
      commissionRateBps = await this.commissionService.getRate(
        booking.vendorId,
        booking.lead?.categoryId ?? undefined,
      );
    }

    // 3. Calculate commission split
    const totalPaise = paymentEntity.amount;
    const commissionPaise = Math.round(
      (totalPaise * commissionRateBps) / 10000,
    );
    const netPayoutPaise = totalPaise - commissionPaise;

    this.logger.log(
      `Commission split: total=${totalPaise}, commission=${commissionPaise} (${commissionRateBps}bps), net=${netPayoutPaise}`,
    );

    // 4. Create Transaction record
    await this.prisma.transaction.create({
      data: {
        bookingId: booking.id,
        type: TransactionType.BOOKING_COMMISSION,
        amountPaise: totalPaise,
        commissionPaise,
        netPayoutPaise,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id,
        status: TransactionStatus.PAID,
        paidAt: new Date(),
      },
    });

    // 5. Update booking paymentStatus to CAPTURED
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: 'CAPTURED' },
    });

    // 6. Mark webhookEvent as PROCESSED
    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    this.logger.log(
      `Payment processed: booking=${booking.id}, transaction created, paymentStatus=CAPTURED`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Payment processing job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? '?'}): ${error.message}`,
      error.stack,
    );
  }
}
