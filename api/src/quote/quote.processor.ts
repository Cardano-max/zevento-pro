import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

/**
 * QuoteExpiryProcessor: BullMQ worker for the 'quote-expiry' queue.
 *
 * Idempotent expiry: uses updateMany with status: 'SUBMITTED' filter.
 * If the quote was already ACCEPTED before the delayed job fires, count=0 → no-op.
 * This prevents accepted quotes from being incorrectly expired.
 */
@Processor('quote-expiry')
@Injectable()
export class QuoteExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(QuoteExpiryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ quoteId: string }>): Promise<void> {
    const { quoteId } = job.data;

    // IDEMPOTENT: only expires if still SUBMITTED
    // If already ACCEPTED/REJECTED, count=0 → no-op
    const result = await this.prisma.quote.updateMany({
      where: { id: quoteId, status: 'SUBMITTED' },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Quote ${quoteId} expired`);
    } else {
      this.logger.debug(
        `Quote ${quoteId} expiry job fired but quote was not in SUBMITTED state — no-op`,
      );
    }
  }
}
