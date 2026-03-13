import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly instance: Razorpay | null;
  private readonly keySecret: string;
  readonly devMode: boolean;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.keySecret = keySecret ?? '';

    if (
      !keyId ||
      !keySecret ||
      process.env.NODE_ENV === 'development'
    ) {
      if (!keyId || !keySecret) {
        this.logger.warn(
          'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set. Running in dev mock mode.',
        );
        this.devMode = true;
        this.instance = null;
      } else {
        this.devMode = false;
        this.instance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
      }
    } else {
      this.devMode = false;
      this.instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
  }

  async createPlan(params: {
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    item: { name: string; amount: number; currency: string; description: string };
  }) {
    if (this.devMode) {
      this.logger.warn('Dev mode: returning mock plan');
      return {
        id: `plan_mock_${Date.now()}`,
        entity: 'plan',
        interval: params.interval,
        period: params.period,
        item: {
          id: `item_mock_${Date.now()}`,
          ...params.item,
        },
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    return this.instance!.plans.create({
      period: params.period,
      interval: params.interval,
      item: {
        name: params.item.name,
        amount: params.item.amount,
        currency: params.item.currency,
        description: params.item.description,
      },
    });
  }

  async createSubscription(params: {
    plan_id: string;
    total_count: number;
    customer_notify?: 0 | 1;
    notes?: Record<string, string>;
  }) {
    if (this.devMode) {
      this.logger.warn('Dev mode: returning mock subscription');
      const mockId = `sub_mock_${Date.now()}`;
      return {
        id: mockId,
        entity: 'subscription',
        plan_id: params.plan_id,
        status: 'created' as const,
        short_url: `https://rzp.io/mock/${mockId}`,
        current_start: null,
        current_end: null,
        total_count: params.total_count,
        paid_count: 0,
        remaining_count: String(params.total_count),
        customer_notify: params.customer_notify ?? 1,
        created_at: Math.floor(Date.now() / 1000),
        charge_at: Math.floor(Date.now() / 1000),
        start_at: Math.floor(Date.now() / 1000),
        end_at: 0,
        auth_attempts: 0,
        has_scheduled_changes: false,
        source: 'api',
        customer_id: null,
        payment_method: null,
      };
    }

    return this.instance!.subscriptions.create({
      plan_id: params.plan_id,
      total_count: params.total_count,
      customer_notify: params.customer_notify,
      notes: params.notes,
    });
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtCycleEnd: boolean,
  ) {
    if (this.devMode) {
      this.logger.warn('Dev mode: mock cancel subscription');
      return { id: subscriptionId, status: 'cancelled' as const };
    }

    return this.instance!.subscriptions.cancel(
      subscriptionId,
      cancelAtCycleEnd,
    );
  }

  async fetchSubscription(subscriptionId: string) {
    if (this.devMode) {
      this.logger.warn('Dev mode: mock fetch subscription');
      return {
        id: subscriptionId,
        entity: 'subscription',
        status: 'active' as const,
      };
    }

    return this.instance!.subscriptions.fetch(subscriptionId);
  }

  // ─── Phase 5: Payment Order, Signature Validation, Refund ──────────

  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }) {
    if (this.devMode) {
      this.logger.warn('Dev mode: returning mock order');
      return {
        id: `order_mock_${Date.now()}`,
        entity: 'order' as const,
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created' as const,
      };
    }

    return this.instance!.orders.create({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
  }

  validatePaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    if (this.devMode) {
      this.logger.warn('Dev mode: skipping payment signature verification');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return expectedSignature === signature;
  }

  async createRefund(
    paymentId: string,
    params: { amount?: number; notes?: Record<string, string> },
  ) {
    if (this.devMode) {
      this.logger.warn('Dev mode: returning mock refund');
      return {
        id: `rfnd_mock_${Date.now()}`,
        payment_id: paymentId,
        amount: params.amount,
        status: 'processed' as const,
      };
    }

    return this.instance!.payments.refund(paymentId, params);
  }

  validateWebhookSignature(
    body: string,
    signature: string,
    secret: string,
  ): boolean {
    if (this.devMode) {
      this.logger.warn(
        'Dev mode: skipping webhook signature verification',
      );
      return true;
    }

    try {
      Razorpay.validateWebhookSignature(body, signature, secret);
      return true;
    } catch {
      // Fallback to manual HMAC-SHA256 comparison
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      return expectedSignature === signature;
    }
  }
}
