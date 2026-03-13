import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PayoutService: Wraps RazorpayX Composite Payout API for vendor disbursement.
 *
 * Uses raw HTTP calls (not the Razorpay SDK, which does not include RazorpayX Payouts).
 * Requires separate credentials: RAZORPAY_X_KEY_ID, RAZORPAY_X_KEY_SECRET, RAZORPAY_X_ACCOUNT_NUMBER.
 *
 * Dev mock mode: When any RazorpayX credential is missing, returns mock payout responses.
 * Consistent with RazorpayService, MSG91, Cloudinary, Firebase dev mock patterns.
 *
 * Key features:
 * - X-Payout-Idempotency header (mandatory since March 2025, Pitfall 7)
 * - Bank detail validation before attempting payout
 * - IMPS transfer mode for instant vendor payouts
 * - queue_if_low_balance: true to prevent failed payouts due to low platform balance
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);
  private readonly xKeyId: string;
  private readonly xKeySecret: string;
  private readonly accountNumber: string;
  readonly devMode: boolean;

  constructor(private readonly prisma: PrismaService) {
    this.xKeyId = process.env.RAZORPAY_X_KEY_ID ?? '';
    this.xKeySecret = process.env.RAZORPAY_X_KEY_SECRET ?? '';
    this.accountNumber = process.env.RAZORPAY_X_ACCOUNT_NUMBER ?? '';

    if (!this.xKeyId || !this.xKeySecret || !this.accountNumber) {
      this.devMode = true;
      this.logger.warn(
        'RAZORPAY_X_KEY_ID, RAZORPAY_X_KEY_SECRET, or RAZORPAY_X_ACCOUNT_NUMBER not set. ' +
          'PayoutService running in dev mock mode.',
      );
    } else {
      this.devMode = false;
    }
  }

  /**
   * Create a vendor payout via RazorpayX Composite Payout API.
   *
   * Checks bank details first. If missing, returns PENDING_BANK_DETAILS status
   * without throwing (payout can be retried later when vendor adds bank info).
   *
   * @returns Payout response with id and status
   */
  async createPayout(params: {
    bookingId: string;
    vendorId: string;
    netPayoutPaise: number;
    razorpayPaymentId: string;
  }): Promise<{ id: string; status: string; amount: number }> {
    // 1. Fetch vendor with bank details and contact info
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: params.vendorId },
      include: {
        user: { select: { phone: true, email: true } },
      },
    });

    if (!vendor) {
      throw new Error(`Vendor ${params.vendorId} not found`);
    }

    // 2. Check bank details -- do NOT throw, return PENDING_BANK_DETAILS
    if (!vendor.bankAccountNumber || !vendor.bankIfsc || !vendor.bankAccountName) {
      this.logger.warn(
        `Vendor ${params.vendorId} missing bank details. Payout deferred.`,
      );

      // Update transaction payoutStatus so it can be retried later
      await this.prisma.transaction.updateMany({
        where: {
          bookingId: params.bookingId,
          type: 'BOOKING_COMMISSION',
        },
        data: { payoutStatus: 'PENDING_BANK_DETAILS' },
      });

      return {
        id: `pending_${params.bookingId}`,
        status: 'PENDING_BANK_DETAILS',
        amount: params.netPayoutPaise,
      };
    }

    // 3. Dev mock mode
    if (this.devMode) {
      this.logger.warn(
        `Dev mode: mock payout of ${params.netPayoutPaise} paise to vendor ${params.vendorId}`,
      );
      return {
        id: `pout_mock_${Date.now()}`,
        status: 'processing',
        amount: params.netPayoutPaise,
      };
    }

    // 4. Build and send RazorpayX Composite Payout API request
    const response = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.xKeyId}:${this.xKeySecret}`).toString('base64')}`,
        'X-Payout-Idempotency': `payout_${params.bookingId}_${params.razorpayPaymentId}`,
      },
      body: JSON.stringify({
        account_number: this.accountNumber,
        fund_account: {
          account_type: 'bank_account',
          bank_account: {
            name: vendor.bankAccountName,
            ifsc: vendor.bankIfsc,
            account_number: vendor.bankAccountNumber,
          },
          contact: {
            name: vendor.businessName,
            type: 'vendor',
            email: vendor.user.email || undefined,
            contact: vendor.user.phone,
          },
        },
        amount: params.netPayoutPaise,
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'vendor_payout',
        queue_if_low_balance: true,
        reference_id: `booking_${params.bookingId}`.substring(0, 40),
        narration: `Zevento payout for booking ${params.bookingId.substring(0, 8)}`,
      }),
    });

    // 5. Parse response
    const body = await response.json();

    if (!response.ok) {
      this.logger.error(
        `RazorpayX Payout API error: ${response.status} ${JSON.stringify(body)}`,
      );
      throw new Error(
        `RazorpayX payout failed: ${response.status} - ${body?.error?.description || JSON.stringify(body)}`,
      );
    }

    this.logger.log(
      `Payout created: id=${body.id}, status=${body.status}, amount=${body.amount}`,
    );

    return {
      id: body.id,
      status: body.status,
      amount: body.amount,
    };
  }
}
