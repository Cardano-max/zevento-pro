import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { BookingService } from './booking.service';
import { BlockDateDto } from './dto/block-date.dto';
import { TransitionStatusDto } from './dto/transition-status.dto';

/**
 * BookingController: Booking lifecycle management and vendor calendar.
 *
 * Booking endpoints (VENDOR or CUSTOMER — both roles can access GET/PATCH):
 *   GET   /bookings/:id              — fetch booking details
 *   PATCH /bookings/:id/status       — transition booking status
 *
 * Vendor calendar endpoints (VENDOR role only):
 *   POST   /vendor/calendar/block    — block a date
 *   DELETE /vendor/calendar/block    — unblock a date (?date=YYYY-MM-DD)
 *   GET    /vendor/calendar          — get blocked + booked dates (?year=&month=)
 *
 * Vendor earnings endpoint (VENDOR role only):
 *   GET /vendor/earnings             — earnings dashboard
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ─── Booking Endpoints ────────────────────────────────────────────────────

  /**
   * GET /bookings/:id
   * Fetch full booking details. Accessible by both the customer and vendor.
   */
  @Get('bookings/:id')
  @Roles('CUSTOMER', 'PLANNER', 'SUPPLIER', 'VENDOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  getBooking(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Req() req: any,
  ) {
    const user = req.user as JwtPayload;
    return this.bookingService.getBooking(bookingId, user.userId);
  }

  /**
   * PATCH /bookings/:id/status
   * Transition booking status. Accessible by both the vendor and customer.
   * Role is read from JWT to determine authorization rules.
   */
  @Patch('bookings/:id/status')
  @Roles('CUSTOMER', 'PLANNER', 'SUPPLIER', 'VENDOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  transitionStatus(
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Req() req: any,
    @Body() dto: TransitionStatusDto,
  ) {
    const user = req.user as JwtPayload;
    return this.bookingService.transitionStatus(
      bookingId,
      user.userId,
      user.activeRole,
      dto,
    );
  }

  // ─── Vendor Calendar Endpoints ────────────────────────────────────────────

  /**
   * POST /vendor/calendar/block
   * Block a calendar date for the authenticated vendor.
   * VendorOwnerGuard resolves vendorId from JWT userId → req.vendorId.
   */
  @Post('vendor/calendar/block')
  @Roles('PLANNER', 'SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  blockDate(@Req() req: any, @Body() dto: BlockDateDto) {
    return this.bookingService.blockDate(req.vendorId, dto);
  }

  /**
   * DELETE /vendor/calendar/block?date=YYYY-MM-DD
   * Unblock a calendar date for the authenticated vendor.
   */
  @Delete('vendor/calendar/block')
  @Roles('PLANNER', 'SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  @HttpCode(HttpStatus.OK)
  unblockDate(@Req() req: any, @Query('date') date: string) {
    return this.bookingService.unblockDate(req.vendorId, date);
  }

  /**
   * GET /vendor/calendar?year=2026&month=3
   * Return blocked dates and booking dates for the vendor's calendar month.
   */
  @Get('vendor/calendar')
  @Roles('PLANNER', 'SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  @HttpCode(HttpStatus.OK)
  getVendorCalendar(
    @Req() req: any,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.bookingService.getVendorCalendar(req.vendorId, year, month);
  }

  // ─── Vendor Earnings Endpoint ─────────────────────────────────────────────

  /**
   * GET /vendor/earnings
   * Return vendor earnings dashboard: leadsReceived, leadsWon, completedBookings, totalEarningsPaise.
   * VendorOwnerGuard resolves vendorId from JWT userId → req.vendorId.
   */
  @Get('vendor/earnings')
  @Roles('PLANNER', 'SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  @HttpCode(HttpStatus.OK)
  getVendorEarnings(@Req() req: any) {
    return this.bookingService.getVendorEarnings(req.vendorId);
  }
}
