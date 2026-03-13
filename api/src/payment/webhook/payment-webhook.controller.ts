import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { PaymentWebhookService } from './payment-webhook.service';

/**
 * PaymentWebhookController: Receives Razorpay payment webhook events.
 *
 * Endpoint: POST /webhooks/razorpay/payment
 * - Public endpoint (no auth guards) -- Razorpay calls this
 * - Separate from SubscriptionWebhookController at /webhooks/razorpay/subscription
 * - Always returns 200 to prevent Razorpay retry storms (existing pattern)
 * - Signature verification handled inside the service
 */
@Controller('webhooks/razorpay')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly paymentWebhookService: PaymentWebhookService,
  ) {}

  @Post('payment')
  @HttpCode(200)
  async handlePaymentWebhook(
    @Req() req: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? '';

    if (!rawBody) {
      this.logger.error('Empty payment webhook body received');
      return { status: 'error', message: 'Empty body' };
    }

    try {
      await this.paymentWebhookService.handleWebhook(rawBody, signature ?? '');
      return { status: 'ok' };
    } catch (error: any) {
      if (error?.status === 401) {
        // Re-throw UnauthorizedException for signature failures
        throw error;
      }

      // For processing errors, still return 200 to avoid Razorpay retries
      this.logger.error(`Payment webhook processing error: ${error.message}`);
      return { status: 'ok' };
    }
  }
}
