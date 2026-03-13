import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationModule } from '../notification/notification.module';
import { VendorModule } from '../vendor/vendor.module';
import { ProductController } from './product.controller';
import { CatalogController } from './catalog.controller';
import { ProductService } from './product.service';
import { CatalogService } from './catalog.service';
import { StockAlertProcessor } from './processor/stock-alert.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'stock-alerts' }),
    NotificationModule,
    VendorModule,
  ],
  controllers: [ProductController, CatalogController],
  providers: [ProductService, CatalogService, StockAlertProcessor],
  exports: [ProductService],
})
export class ProductModule {}
