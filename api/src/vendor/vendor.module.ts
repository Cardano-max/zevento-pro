import { Module } from '@nestjs/common';
import {
  VendorController,
  VendorServicesController,
  VendorConversationsController,
} from './vendor.controller';
import { VendorService } from './vendor.service';
import { VendorOwnerGuard } from './guards/vendor-owner.guard';

@Module({
  controllers: [VendorController, VendorServicesController, VendorConversationsController],
  providers: [VendorService, VendorOwnerGuard],
  exports: [VendorService, VendorOwnerGuard],
})
export class VendorModule {}
