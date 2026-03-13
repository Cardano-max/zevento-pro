import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CommissionService } from './commission.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [SubscriptionModule],
  controllers: [PaymentController],
  providers: [CommissionService, PaymentService],
  exports: [PaymentService, CommissionService],
})
export class PaymentModule {}
