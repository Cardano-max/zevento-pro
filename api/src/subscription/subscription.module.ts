import { Module } from '@nestjs/common';
import { VendorModule } from '../vendor/vendor.module';
import { RazorpayService } from './razorpay.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [VendorModule],
  controllers: [SubscriptionController],
  providers: [RazorpayService, SubscriptionService],
  exports: [SubscriptionService, RazorpayService],
})
export class SubscriptionModule {}
