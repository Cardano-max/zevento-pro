import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { VendorModule } from '../vendor/vendor.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

/**
 * BookingModule: Booking lifecycle management + vendor calendar + earnings.
 *
 * Imports:
 * - PrismaModule: global — no explicit import needed
 * - NotificationModule: exports NotificationService for customer push notifications
 * - VendorModule: exports VendorOwnerGuard for calendar and earnings endpoints
 *
 * Exports:
 * - BookingService: available to other modules if needed
 */
@Module({
  imports: [NotificationModule, VendorModule],
  providers: [BookingService],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
