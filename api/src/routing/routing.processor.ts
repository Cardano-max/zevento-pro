import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LEAD_ROUTING_QUEUE } from './routing.constants';
import { RoutingService } from './routing.service';

/**
 * BullMQ worker processor for the lead-routing queue.
 *
 * Consumes jobs enqueued by LeadService.createInquiry and delegates to
 * RoutingService based on the routing mode:
 *   - Mode A: Direct routing to a single target vendor
 *   - Mode B: Score-based routing to Top N eligible vendors
 *
 * Jobs are configured with 3 attempts and exponential backoff (1s base).
 * Failed jobs are logged via the @OnWorkerEvent('failed') handler.
 */
@Processor(LEAD_ROUTING_QUEUE)
export class RoutingProcessor extends WorkerHost {
  private readonly logger = new Logger(RoutingProcessor.name);

  constructor(private readonly routingService: RoutingService) {
    super();
  }

  /**
   * Process a lead routing job.
   * Mode A → routeDirect (single vendor assignment)
   * Mode B → routeTopThree (scored multi-vendor assignment)
   */
  async process(
    job: Job<{ leadId: string; mode: 'A' | 'B' }>,
  ): Promise<void> {
    this.logger.log(
      `Processing lead routing job ${job.id}: leadId=${job.data.leadId}, mode=${job.data.mode}`,
    );

    if (job.data.mode === 'A') {
      await this.routingService.routeDirect(job.data.leadId);
    } else {
      await this.routingService.routeTopThree(job.data.leadId);
    }

    this.logger.log(
      `Lead routing job ${job.id} completed successfully`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Lead routing job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? '?'}): ${error.message}`,
      error.stack,
    );
  }
}
