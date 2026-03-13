import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { VendorModule } from '../vendor/vendor.module';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderPaymentProcessor } from './processor/order-payment.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'stock-alerts' },
      { name: 'product-order-payment' },
    ),
    NotificationModule,
    PaymentModule,
    VendorModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, VendorOwnerGuard, OrderPaymentProcessor],
  exports: [OrderService],
})
export class OrderModule {}
