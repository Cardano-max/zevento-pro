import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';

/**
 * StockAlertProcessor: BullMQ worker for the 'stock-alerts' queue.
 *
 * When a product's stock drops below its lowStockThreshold,
 * sends a push notification to the vendor via NotificationService.
 */
@Processor('stock-alerts')
@Injectable()
export class StockAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(StockAlertProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(
    job: Job<{ productId: string; currentStock: number }>,
  ): Promise<void> {
    const { productId, currentStock } = job.data;

    this.logger.log(
      `Processing low-stock alert: productId=${productId}, currentStock=${currentStock}`,
    );

    // Fetch product with vendor info
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        lowStockThreshold: true,
      },
    });

    if (!product) {
      this.logger.warn(`Product ${productId} not found — skipping alert`);
      return;
    }

    // Confirm stock is still below threshold (may have been restocked)
    if (currentStock <= product.lowStockThreshold) {
      await this.notificationService.sendPushToVendor(product.vendorId, {
        leadId: product.id,
        eventType: `Low stock: ${product.name} (${currentStock} remaining)`,
        city: 'Inventory Alert',
      });

      this.logger.log(
        `Low-stock notification sent to vendor ${product.vendorId} for product ${product.name}`,
      );
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Stock alert job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? '?'}): ${error.message}`,
      error.stack,
    );
  }
}
