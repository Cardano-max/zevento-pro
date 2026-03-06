import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SubscriptionStatus, TransactionStatus, TransactionType, WebhookEventStatus } from '@zevento/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RazorpayService } from '../razorpay.service';

@Injectable()
export class SubscriptionWebhookService {
  private readonly logger = new Logger(SubscriptionWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  async handleWebhook(rawBody: string, signature: string) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

    // 1. Verify signature
    const isValid = this.razorpay.validateWebhookSignature(
      rawBody,
      signature,
      webhookSecret,
    );

    if (!isValid) {
      this.logger.error('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. Parse payload AFTER verification
    const payload = JSON.parse(rawBody);
    const event: string = payload.event;
    const subscriptionEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;

    if (!subscriptionEntity) {
      this.logger.warn('Webhook payload missing subscription entity');
      return;
    }

    const subscriptionId: string = subscriptionEntity.id;

    // Build unique externalId for idempotency
    const uniquePart = paymentEntity?.id ?? payload.created_at ?? Date.now();
    const externalId = `${subscriptionId}_${event}_${uniquePart}`;

    this.logger.log(
      `Processing webhook: event=${event}, subscriptionId=${subscriptionId}, externalId=${externalId}`,
    );

    // 3. Idempotency check — try to create WebhookEvent
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
      // P2002 = unique constraint violation
      if (error?.code === 'P2002') {
        this.logger.log(`Duplicate event skipped: ${externalId}`);
        return;
      }
      throw error;
    }

    // 4. Find the local subscription record
    const vendorSubscription =
      await this.prisma.vendorSubscription.findUnique({
        where: { razorpaySubscriptionId: subscriptionId },
      });

    if (!vendorSubscription) {
      this.logger.error(
        `Orphaned webhook: no VendorSubscription for razorpaySubscriptionId=${subscriptionId}`,
      );
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
      return;
    }

    // 5. Process by event type
    try {
      await this.processEvent(
        event,
        vendorSubscription.id,
        vendorSubscription.vendorId,
        subscriptionEntity,
        paymentEntity,
      );

      // 6. Mark webhook as processed
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Error processing webhook event ${externalId}: ${error}`,
      );

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: WebhookEventStatus.FAILED },
      });

      // Still return 200 to Razorpay to avoid retries for processing bugs
      // But throw so NestJS logs the error
      throw error;
    }
  }

  private async processEvent(
    event: string,
    vendorSubscriptionId: string,
    vendorId: string,
    subscriptionEntity: any,
    paymentEntity: any,
  ) {
    switch (event) {
      case 'subscription.authenticated':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.AUTHENTICATED,
        );
        break;

      case 'subscription.activated':
        await this.prisma.vendorSubscription.update({
          where: { vendorId },
          data: {
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: subscriptionEntity.current_start
              ? new Date(subscriptionEntity.current_start * 1000)
              : undefined,
            currentPeriodEnd: subscriptionEntity.current_end
              ? new Date(subscriptionEntity.current_end * 1000)
              : undefined,
          },
        });
        break;

      case 'subscription.charged':
        await this.prisma.$transaction(async (tx) => {
          // Update subscription status and period
          await tx.vendorSubscription.update({
            where: { vendorId },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodStart: subscriptionEntity.current_start
                ? new Date(subscriptionEntity.current_start * 1000)
                : undefined,
              currentPeriodEnd: subscriptionEntity.current_end
                ? new Date(subscriptionEntity.current_end * 1000)
                : undefined,
            },
          });

          // Create transaction record
          if (paymentEntity) {
            await tx.transaction.create({
              data: {
                vendorSubscriptionId,
                type: TransactionType.SUBSCRIPTION,
                amountPaise: paymentEntity.amount,
                razorpayPaymentId: paymentEntity.id,
                status: TransactionStatus.PAID,
                paidAt: paymentEntity.captured_at
                  ? new Date(paymentEntity.captured_at * 1000)
                  : new Date(),
              },
            });
          }
        });
        break;

      case 'subscription.pending':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.PENDING,
        );
        break;

      case 'subscription.halted':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.HALTED,
        );
        break;

      case 'subscription.cancelled':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.CANCELLED,
        );
        break;

      case 'subscription.paused':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.PAUSED,
        );
        break;

      case 'subscription.resumed':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.ACTIVE,
        );
        break;

      case 'subscription.completed':
        await this.updateSubscriptionStatus(
          vendorId,
          SubscriptionStatus.COMPLETED,
        );
        break;

      default:
        this.logger.warn(`Unknown subscription event type: ${event}`);
        break;
    }
  }

  private async updateSubscriptionStatus(
    vendorId: string,
    status: string,
  ) {
    await this.prisma.vendorSubscription.update({
      where: { vendorId },
      data: { status },
    });
  }
}
