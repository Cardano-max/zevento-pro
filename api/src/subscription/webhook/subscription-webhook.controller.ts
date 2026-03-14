import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SubscriptionWebhookService } from './subscription-webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks/razorpay')
export class SubscriptionWebhookController {
  private readonly logger = new Logger(SubscriptionWebhookController.name);

  constructor(
    private readonly webhookService: SubscriptionWebhookService,
  ) {}

  @Post('subscription')
  @HttpCode(200)
  async handleSubscriptionWebhook(
    @Req() req: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? '';

    if (!rawBody) {
      this.logger.error('Empty webhook body received');
      return { status: 'error', message: 'Empty body' };
    }

    try {
      await this.webhookService.handleWebhook(rawBody, signature ?? '');
      return { status: 'ok' };
    } catch (error: any) {
      if (error?.status === 401) {
        // Re-throw UnauthorizedException for signature failures
        throw error;
      }

      // For processing errors, still return 200 to avoid Razorpay retries
      // The error is already logged by the service
      this.logger.error(`Webhook processing error: ${error.message}`);
      return { status: 'ok' };
    }
  }
}
