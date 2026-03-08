import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { RespondReviewDto } from './dto/respond-review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * createReview: Allow a customer to review a COMPLETED booking.
   *
   * Guards:
   * - Booking must exist and belong to this customer
   * - Booking must be in COMPLETED status (403 otherwise)
   * - Only one review per booking allowed (409 on duplicate)
   *
   * After creating the review:
   * - Updates VendorStats.averageRating using incremental formula:
   *     newAvg = (oldAvg * oldCount + rating) / (oldCount + 1)
   * - Invalidates Redis scoring cache for the vendor
   */
  async createReview(bookingId: string, customerId: string, dto: CreateReviewDto) {
    // Fetch booking to validate status and ownership
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Not your booking');
    }

    if (booking.status !== 'COMPLETED') {
      throw new ForbiddenException(
        'Booking must be completed before leaving a review',
      );
    }

    // Check no review exists yet (one-per-booking enforced by @@unique in schema)
    const existingReview = await this.prisma.review.findUnique({
      where: { bookingId },
    });

    if (existingReview) {
      throw new ConflictException('A review already exists for this booking');
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        bookingId,
        customerId,
        vendorId: booking.vendorId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });

    // Update VendorStats with incremental average formula
    // newAvg = (oldAvg * oldCount + newRating) / (oldCount + 1)
    const stats = await this.prisma.vendorStats.findUnique({
      where: { vendorId: booking.vendorId },
    });
    const oldCount = stats?.totalReviewCount ?? 0;
    const oldAvg = stats?.averageRating ?? 3.0;
    const newAvg = (oldAvg * oldCount + dto.rating) / (oldCount + 1);

    await this.prisma.vendorStats.update({
      where: { vendorId: booking.vendorId },
      data: {
        averageRating: newAvg,
        totalReviewCount: { increment: 1 },
      },
    });

    // Invalidate Redis scoring cache so next routing picks up new rating
    await this.redis.del(`vendor:score:factors:${booking.vendorId}`);

    this.logger.log(
      `Review created for booking ${bookingId} by customer ${customerId} (rating: ${dto.rating}, newAvg: ${newAvg.toFixed(2)})`,
    );

    return review;
  }

  /**
   * respondToReview: Allow a vendor to publicly respond to a review.
   * Subsequent responses overwrite the previous vendorResponse field.
   */
  async respondToReview(reviewId: string, vendorId: string, dto: RespondReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }

    if (review.vendorId !== vendorId) {
      throw new ForbiddenException(
        'You can only respond to reviews for your own bookings',
      );
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        vendorResponse: dto.response,
        respondedAt: new Date(),
      },
    });

    this.logger.log(`Vendor ${vendorId} responded to review ${reviewId}`);

    return updated;
  }

  /**
   * getVendorReviews: Paginated public list of reviews for a vendor.
   * Includes customer name (not phone) and booking event type.
   * No auth required — public storefront endpoint.
   */
  async getVendorReviews(vendorId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { vendorId },
        include: {
          customer: { select: { id: true, name: true } },
          booking: {
            include: {
              lead: { select: { eventType: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { vendorId } }),
    ]);

    return { data: reviews, total, page, limit };
  }
}
