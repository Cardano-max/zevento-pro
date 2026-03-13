import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhookEventStatus } from '@zevento/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../../subscription/razorpay.service';

/**
 * PaymentWebhookService: Processes Razorpay payment webhook events.
 *
 * Flow:
 *   1. Verify webhook signature
 *   2. Parse payload, extract payment/order entities
 *   3. Idempotency check via webhook_events unique constraint (P2002 catch)
 *   4. Route by event type:
 *      - payment.captured -> route by notes.type:
 *          MARKETPLACE_SALE -> product-order-payment queue
 *          default (BOOKING_COMMISSION) -> payment-processing queue
 *      - payment.failed -> route by notes.type:
 *          MARKETPLACE_SALE -> update ProductOrder FAILED + restore stock
 *          default -> update Booking FAILED (existing behavior)
 *      - refund.processed -> update Transaction to REFUNDED
 *      - default -> log warning, mark webhook as PROCESSED
 *
 * Pattern: Identical to SubscriptionWebhookService for idempotency + always-200 semantics.
 * Processing happens asynchronously in BullMQ worker, not synchronously in this handler.
 */
@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    @InjectQueue('payment-processing') private readonly paymentQueue: Queue,
    @InjectQueue('product-order-payment')
    private readonly productOrderPaymentQueue: Queue,
  ) {}

  async handleWebhook(rawBody: string, signature: string) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

    // 1. Verify signature
    const isValid = this.razorpayService.validateWebhookSignature(
      rawBody,
      signature,
      webhookSecret,
    );

    if (!isValid) {
      this.logger.error('Invalid payment webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Parse payload AFTER verification
    const payload = JSON.parse(rawBody);
    const event: string = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;

    if (!paymentEntity) {
      this.logger.warn('Payment webhook payload missing payment entity');
      return;
    }

    // 3. Build idempotency key: paymentId_event (e.g. pay_ABC123_payment.captured)
    const externalId = `${paymentEntity.id}_${event}`;

    this.logger.log(
      `Processing payment webhook: event=${event}, paymentId=${paymentEntity.id}, externalId=${externalId}`,
    );

    // 4. Idempotency check -- try to create WebhookEvent (P2002 catch for duplicates)
    let webhookEvent;
    try {
      webhookEvent = await this.prisma.webhookEvent.create({
        data: {
          provider: 'RAZORPAY',
          externalId,
          eventType: event,
          status: WebhookEventStatus.RECEIVED,
          payload: payload,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        this.logger.log(`Duplicate payment event skipped: ${externalId}`);
        return;
      }
      throw error;
    }

    // 5. Route by event type
    try {
      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(webhookEvent.id, paymentEntity);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(paymentEntity);
          await this.markWebhookProcessed(webhookEvent.id);
          break;

        case 'refund.processed':
          await this.handleRefundProcessed(paymentEntity);
          await this.markWebhookProcessed(webhookEvent.id);
          break;

        default:
          this.logger.warn(`Unhandled payment event type: ${event}`);
          await this.markWebhookProcessed(webhookEvent.id);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error processing payment webhook event ${externalId}: ${error}`,
      );

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: WebhookEventStatus.FAILED },
      });

      throw error;
    }
  }

  /**
   * payment.captured: Route to correct BullMQ queue based on notes.type.
   *
   * MARKETPLACE_SALE -> product-order-payment queue (OrderPaymentProcessor)
   * default (BOOKING_COMMISSION or no type) -> payment-processing queue (PaymentProcessor)
   */
  private async handlePaymentCaptured(
    webhookEventId: string,
    paymentEntity: any,
  ) {
    const notes = paymentEntity.notes || {};
    const paymentType = notes.type;

    if (paymentType === 'MARKETPLACE_SALE') {
      // Route to product order payment processing queue
      await this.productOrderPaymentQueue.add(
        'product-order-payment-captured',
        { webhookEventId, paymentEntity, orderNotes: notes },
        { attempts: 3, backoff: { type: 'exponential', delay: 60000 } },
      );
      this.logger.log(
        `Enqueued product-order-payment job for payment ${paymentEntity.id}`,
      );
    } else {
      // Default: route to booking payment processing (existing behavior)
      await this.paymentQueue.add(
        'payment-captured',
        {
          webhookEventId,
          paymentEntity,
          orderNotes: notes,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60000 },
        },
      );
      this.logger.log(
        `Enqueued payment-processing job for payment ${paymentEntity.id}`,
      );
    }
  }

  /**
   * payment.failed: Route by notes.type.
   *
   * MARKETPLACE_SALE -> find ProductOrder by razorpayOrderId, set paymentStatus FAILED,
   *                     restore stock via increment for each order item.
   * default -> update Booking paymentStatus FAILED (existing behavior).
   */
  private async handlePaymentFailed(paymentEntity: any) {
    const orderId = paymentEntity.order_id;
    if (!orderId) {
      this.logger.warn('payment.failed event has no order_id');
      return;
    }

    const notes = paymentEntity.notes || {};
    const paymentType = notes.type;

    if (paymentType === 'MARKETPLACE_SALE') {
      // Find ProductOrder and restore stock
      const productOrder = await this.prisma.productOrder.findFirst({
        where: { razorpayOrderId: orderId },
        include: { items: true },
      });

      if (productOrder) {
        // Restore stock for each item
        await this.prisma.$transaction(async (tx) => {
          for (const item of productOrder.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
          await tx.productOrder.update({
            where: { id: productOrder.id },
            data: { paymentStatus: 'FAILED' },
          });
        });

        this.logger.log(
          `ProductOrder ${productOrder.id} payment FAILED — stock restored for ${productOrder.items.length} item(s) (order ${orderId})`,
        );
      } else {
        this.logger.warn(
          `No ProductOrder found for order ${orderId} in payment.failed event (MARKETPLACE_SALE)`,
        );
      }
    } else {
      // Default: update booking paymentStatus to FAILED (existing behavior)
      const booking = await this.prisma.booking.findFirst({
        where: { razorpayOrderId: orderId },
      });

      if (booking) {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: 'FAILED' },
        });
        this.logger.log(
          `Booking ${booking.id} payment status set to FAILED (order ${orderId})`,
        );
      } else {
        this.logger.warn(
          `No booking found for order ${orderId} in payment.failed event`,
        );
      }
    }
  }

  /**
   * refund.processed: Update Transaction status to REFUNDED and booking paymentStatus.
   * Matches by razorpayPaymentId on the Transaction record.
   */
  private async handleRefundProcessed(paymentEntity: any) {
    const paymentId = paymentEntity.id;

    const transaction = await this.prisma.transaction.findUnique({
      where: { razorpayPaymentId: paymentId },
    });

    if (transaction) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'REFUNDED' },
      });

      // Also update booking paymentStatus if linked
      if (transaction.bookingId) {
        await this.prisma.booking.update({
          where: { id: transaction.bookingId },
          data: { paymentStatus: 'REFUNDED' },
        });
      }

      this.logger.log(
        `Transaction ${transaction.id} marked REFUNDED for payment ${paymentId}`,
      );
    } else {
      this.logger.warn(
        `No transaction found for payment ${paymentId} in refund.processed event`,
      );
    }
  }

  /**
   * Mark a webhookEvent as PROCESSED with timestamp.
   */
  private async markWebhookProcessed(webhookEventId: string) {
    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
      },
    });
  }
}
