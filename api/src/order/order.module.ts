import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentModule } from '../payment/payment.module';
import { VendorModule } from '../vendor/vendor.module';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'stock-alerts' },
      { name: 'product-order-payment' },
    ),
    PaymentModule,
    VendorModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, VendorOwnerGuard],
  exports: [OrderService],
})
export class OrderModule {}
