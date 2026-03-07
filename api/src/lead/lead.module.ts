import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LEAD_ROUTING_QUEUE } from '../routing/routing.constants';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: LEAD_ROUTING_QUEUE }),
  ],
  controllers: [LeadController],
  providers: [LeadService, ScoringService],
  exports: [ScoringService],
})
export class LeadModule {}
