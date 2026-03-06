import { Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import { VendorOwnerGuard } from './guards/vendor-owner.guard';

@Module({
  controllers: [VendorController],
  providers: [VendorService, VendorOwnerGuard],
  exports: [VendorService, VendorOwnerGuard],
})
export class VendorModule {}
