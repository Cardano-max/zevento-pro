import { Module } from '@nestjs/common';
import { VendorModule } from '../vendor/vendor.module';
import { RazorpayService } from './razorpay.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionWebhookController } from './webhook/subscription-webhook.controller';
import { SubscriptionWebhookService } from './webhook/subscription-webhook.service';

@Module({
  imports: [VendorModule],
  controllers: [SubscriptionController, SubscriptionWebhookController],
  providers: [
    RazorpayService,
    SubscriptionService,
    SubscriptionWebhookService,
  ],
  exports: [SubscriptionService, RazorpayService],
})
export class SubscriptionModule {}
