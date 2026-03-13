import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentStatus } from '@zevento/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RazorpayService } from '../subscription/razorpay.service';
import { CommissionService } from './commission.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

/**
 * PaymentService: Razorpay order creation for booking checkout
 * and client-side payment signature verification.
 *
 * - createBookingOrder: Creates a Razorpay order for a BOOKED booking,
 *   locks commission rate on booking, returns order details for client checkout.
 * - verifyPayment: Validates Razorpay payment signature from client callback,
 *   optimistically updates booking paymentStatus (webhook is source of truth).
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly commissionService: CommissionService,
  ) {}

  /**
   * Create a Razorpay order for a confirmed (BOOKED) booking.
   *
   * 1. Validate booking ownership, status, and payment state
   * 2. Look up and lock commission rate
   * 3. Create Razorpay order via SDK
   * 4. Store order reference and locked rate on booking
   * 5. Return order details for client Razorpay Checkout
   */
  async createBookingOrder(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        quote: true,
        vendor: { select: { id: true, businessName: true } },
        lead: { select: { categoryId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'BOOKED') {
      throw new BadRequestException('Booking is not in a payable state');
    }

    // Allow retry if payment failed; block if already initiated and not failed
    if (
      booking.razorpayOrderId &&
      booking.paymentStatus !== PaymentStatus.FAILED
    ) {
      throw new BadRequestException('Payment already initiated');
    }

    // Lock commission rate at order creation time (Pitfall 4: rate changes between booking and payment)
    const commissionRateBps = await this.commissionService.getRate(
      booking.vendorId,
      booking.lead?.categoryId,
    );

    // Create Razorpay order
    const order = await this.razorpayService.createOrder({
      amount: booking.quote.totalPaise,
      currency: 'INR',
      receipt: `bkg_${booking.id.substring(0, 30)}`,
      notes: {
        bookingId: booking.id,
        vendorId: booking.vendorId,
        customerId: booking.customerId,
        type: 'BOOKING_COMMISSION',
        commissionRateBps: String(commissionRateBps),
      },
    });

    // Store order reference and locked commission rate on booking
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        razorpayOrderId: order.id,
        paymentStatus: PaymentStatus.PENDING,
        commissionRateBps,
      },
    });

    this.logger.log(
      `Razorpay order created: orderId=${order.id}, bookingId=${bookingId}, amount=${order.amount}, commissionBps=${commissionRateBps}`,
    );

    return {
      orderId: order.id,
      amount: order.amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    };
  }

  /**
   * Verify Razorpay payment signature from client callback.
   *
   * This is an optimistic update for immediate UX feedback.
   * The webhook (payment.captured) is the source of truth and
   * will create the Transaction record + trigger payout.
   *
   * Does NOT create a Transaction record (Pitfall 3: race between verify and webhook).
   */
  async verifyPayment(dto: VerifyPaymentDto) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

    // Verify HMAC SHA256 signature: orderId|paymentId signed with key_secret
    const isValid = this.razorpayService.validatePaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid payment signature');
    }

    // Optimistic booking update for UX (webhook is source of truth)
    const booking = await this.prisma.booking.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (booking) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: PaymentStatus.CAPTURED },
      });

      this.logger.log(
        `Payment verified: bookingId=${booking.id}, paymentId=${razorpay_payment_id}`,
      );
    } else {
      this.logger.warn(
        `No booking found for orderId=${razorpay_order_id} during payment verification`,
      );
    }

    return { status: 'ok', paymentId: razorpay_payment_id };
  }
}
