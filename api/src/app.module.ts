import { BullModule } from '@nestjs/bullmq';
import { Controller, Get, Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CustomerModule } from './customer/customer.module';
import { InboxModule } from './inbox/inbox.module';
import { LeadModule } from './lead/lead.module';
import { QuoteModule } from './quote/quote.module';
import { NotificationModule } from './notification/notification.module';
import { PaymentModule } from './payment/payment.module';
import { ProductModule } from './product/product.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RedisModule } from './redis/redis.module';
import { ReviewModule } from './review/review.module';
import { RoutingModule } from './routing/routing.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { VendorModule } from './vendor/vendor.module';

@Controller()
class AppController {
  @Get()
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zevento-api',
      version: '0.0.0',
    };
  }
}

/**
 * Parse REDIS_URL (redis://host:port) into host and port for BullMQ.
 * BullMQ requires its own connection config with maxRetriesPerRequest: null
 * (Pitfall 1 from research — cannot share the ioredis instance from RedisService).
 */
function parseBullRedisConnection() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BullModule.forRoot({
      connection: parseBullRedisConnection(),
    }),
    AuthModule,
    AdminModule,
    PrivacyModule,
    CloudinaryModule,
    VendorModule,
    SubscriptionModule,
    CustomerModule,
    LeadModule,
    NotificationModule,
    RoutingModule,
    InboxModule,
    QuoteModule,
    BookingModule,
    ReviewModule,
    PaymentModule,
    ProductModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
