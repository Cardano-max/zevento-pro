import { Module } from '@nestjs/common';
import { VendorModule } from '../vendor/vendor.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

/**
 * ReviewModule: Customer reviews + vendor responses.
 *
 * Imports:
 * - PrismaModule: global — no explicit import needed
 * - RedisModule: global — no explicit import needed
 * - VendorModule: exports VendorOwnerGuard for vendor respond endpoint
 */
@Module({
  imports: [VendorModule],
  providers: [ReviewService],
  controllers: [ReviewController],
})
export class ReviewModule {}
