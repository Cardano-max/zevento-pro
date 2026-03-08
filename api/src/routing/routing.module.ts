import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { InboxModule } from '../inbox/inbox.module';
import { LeadModule } from '../lead/lead.module';
import { NotificationModule } from '../notification/notification.module';
import { LEAD_ROUTING_QUEUE } from './routing.constants';
import { RoutingProcessor } from './routing.processor';
import { RoutingService } from './routing.service';

/**
 * RoutingModule: Lead routing engine with real-time Socket.IO delivery.
 *
 * InboxModule is imported here to provide InboxGateway to RoutingService.
 * InboxModule does NOT import RoutingModule — no circular dependency.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: LEAD_ROUTING_QUEUE }),
    LeadModule,
    NotificationModule,
    InboxModule, // exports InboxGateway — used for real-time emitToVendor calls
  ],
  providers: [RoutingService, RoutingProcessor],
})
export class RoutingModule {}
