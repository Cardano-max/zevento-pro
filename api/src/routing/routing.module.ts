import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LeadModule } from '../lead/lead.module';
import { NotificationModule } from '../notification/notification.module';
import { LEAD_ROUTING_QUEUE } from './routing.constants';
import { RoutingProcessor } from './routing.processor';
import { RoutingService } from './routing.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: LEAD_ROUTING_QUEUE }),
    LeadModule,
    NotificationModule,
  ],
  providers: [RoutingService, RoutingProcessor],
})
export class RoutingModule {}
