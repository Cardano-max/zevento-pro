import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { VendorModule } from '../vendor/vendor.module';
import { InboxController } from './inbox.controller';
import { InboxGateway } from './inbox.gateway';
import { InboxService } from './inbox.service';

/**
 * InboxModule: Vendor lead inbox — WebSocket gateway + REST endpoints.
 *
 * Imports:
 * - PrismaModule: database access in gateway and service
 * - AuthModule: exports JwtModule (JwtService used in gateway socket middleware)
 * - RedisModule: scoring cache invalidation in InboxService (global, so optional to import)
 * - VendorModule: exports VendorOwnerGuard for controller
 *
 * Exports:
 * - InboxGateway: MUST be exported so RoutingModule can import and inject it
 *   in Plan 04-03 to call emitToVendor() after assignment creation.
 */
@Module({
  imports: [PrismaModule, AuthModule, RedisModule, VendorModule],
  providers: [InboxGateway, InboxService],
  controllers: [InboxController],
  exports: [InboxGateway],
})
export class InboxModule {}
