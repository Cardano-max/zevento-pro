import { Controller, Get, Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { CustomerModule } from './customer/customer.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RedisModule } from './redis/redis.module';
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

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, AdminModule, PrivacyModule, CloudinaryModule, VendorModule, SubscriptionModule, CustomerModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
