import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CommissionService } from './commission.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentWebhookController } from './webhook/payment-webhook.controller';
import { PaymentWebhookService } from './webhook/payment-webhook.service';
import { PaymentProcessor } from './processor/payment.processor';
import { PayoutProcessor } from './processor/payout.processor';
import { PayoutService } from './payout.service';

@Module({
  imports: [
    SubscriptionModule,
    BullModule.registerQueue(
      { name: 'payment-processing' },
      { name: 'vendor-payout' },
    ),
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    CommissionService,
    PaymentService,
    PaymentWebhookService,
    PaymentProcessor,
    PayoutProcessor,
    PayoutService,
  ],
  exports: [PaymentService, CommissionService, PayoutService],
})
export class PaymentModule {}
