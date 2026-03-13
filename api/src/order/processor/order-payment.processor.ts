import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  TransactionType,
  TransactionStatus,
  WebhookEventStatus,
} from '@zevento/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CommissionService } from '../../payment/commission.service';
import { NotificationService } from '../../notification/notification.service';

/**
 * OrderPaymentProcessor: BullMQ worker for the 'product-order-payment' queue.
 *
 * Mirrors PaymentProcessor pattern exactly but for B2B product orders.
 *
 * Processes product-order-payment-captured events asynchronously:
 *   1. Find ProductOrder by razorpayOrderId
 *   2. Get commission rate: prefer locked rate on order, fallback to CommissionService (null categoryId)
 *   3. Calculate commission split: commissionPaise, netPayoutPaise
 *   4. Create MARKETPLACE_SALE Transaction with productOrderId FK
 *   5. Update ProductOrder paymentStatus to CAPTURED
 *   6. Mark webhookEvent as PROCESSED
 *   7. Send push notification to vendor
 */
@Processor('product-order-payment')
@Injectable()
export class OrderPaymentProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderPaymentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: CommissionService,
    private readonly notificationService: NotificationService,
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
    const { webhookEventId, paymentEntity } = job.data;

    this.logger.log(
      `Processing product order payment captured: paymentId=${paymentEntity.id}, orderId=${paymentEntity.order_id}`,
    );

    // 1. Find ProductOrder by razorpayOrderId
    const productOrder = await this.prisma.productOrder.findFirst({
      where: { razorpayOrderId: paymentEntity.order_id },
    });

    if (!productOrder) {
      this.logger.error(
        `No ProductOrder found for order ${paymentEntity.order_id}. Marking webhook as FAILED.`,
      );
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: WebhookEventStatus.FAILED },
      });
      return;
    }

    // 2. Get commission rate: prefer locked rate, fallback to CommissionService
    // null categoryId for product orders (Pitfall 3 — ProductCategory is separate from EventCategory)
    let commissionRateBps = productOrder.commissionRateBps;
    if (commissionRateBps == null) {
      this.logger.warn(
        `ProductOrder ${productOrder.id} has no locked commission rate. Falling back to CommissionService.`,
      );
      commissionRateBps = await this.commissionService.getRate(
        productOrder.vendorId,
        null,
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

    // 4. Create MARKETPLACE_SALE Transaction with productOrderId FK
    await this.prisma.transaction.create({
      data: {
        productOrderId: productOrder.id,
        type: TransactionType.MARKETPLACE_SALE,
        amountPaise: totalPaise,
        commissionPaise,
        netPayoutPaise,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id,
        status: TransactionStatus.PAID,
        paidAt: new Date(),
      },
    });

    // 5. Update ProductOrder paymentStatus to CAPTURED
    await this.prisma.productOrder.update({
      where: { id: productOrder.id },
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

    // 7. Send push notification to vendor (fire-and-forget, non-blocking)
    try {
      await this.notificationService.sendPushToVendor(productOrder.vendorId, {
        leadId: productOrder.id,
        eventType: 'New product order received!',
        city: 'Order Alert',
      });
    } catch (error) {
      // Notification failure should not fail the payment processing job
      this.logger.warn(
        `Failed to send push notification to vendor ${productOrder.vendorId}: ${error}`,
      );
    }

    this.logger.log(
      `Product order payment processed: order=${productOrder.id}, transaction created, paymentStatus=CAPTURED`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Product order payment job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? '?'}): ${error.message}`,
      error.stack,
    );
  }
}
