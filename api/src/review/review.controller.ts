import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { RespondReviewDto } from './dto/respond-review.dto';
import { ReviewService } from './review.service';

/**
 * ReviewController: Customer reviews and vendor responses.
 *
 * Authenticated endpoints:
 *   POST  /bookings/:bookingId/review  — Customer leaves a review (COMPLETED bookings only)
 *   PATCH /reviews/:id/respond         — Vendor responds to a review
 *
 * Public endpoints:
 *   GET /vendor/:vendorId/reviews      — Public paginated review list (no auth)
 */
@ApiTags('Reviews')
@ApiBearerAuth('JWT')
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * POST /bookings/:bookingId/review
   * Customer submits a review for a completed booking.
   * Returns 403 if booking is not COMPLETED or not owned by this customer.
   */
  @Post('bookings/:bookingId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  createReview(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Req() req: any,
    @Body() dto: CreateReviewDto,
  ) {
    const user = req.user as JwtPayload;
    return this.reviewService.createReview(bookingId, user.userId, dto);
  }

  /**
   * PATCH /reviews/:id/respond
   * Vendor submits a public response to a customer review.
   * Subsequent calls overwrite the previous response (no separate history).
   * VendorOwnerGuard resolves vendorId from JWT userId → req.vendorId.
   */
  @Patch('reviews/:id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard, VendorOwnerGuard)
  @Roles('PLANNER', 'SUPPLIER')
  @HttpCode(HttpStatus.OK)
  respondToReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Req() req: any,
    @Body() dto: RespondReviewDto,
  ) {
    return this.reviewService.respondToReview(reviewId, req.vendorId, dto);
  }

  /**
   * GET /vendor/:vendorId/reviews
   * Public paginated list of reviews for a vendor.
   * No authentication required — storefront endpoint.
   */
  @Get('vendor/:vendorId/reviews')
  @HttpCode(HttpStatus.OK)
  getVendorReviews(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.reviewService.getVendorReviews(vendorId, page, limit);
  }
}
