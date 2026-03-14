import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateProductOrderPaymentDto } from './dto/create-product-order-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentService } from './payment.service';

/**
 * PaymentController: Customer-facing booking payment endpoints.
 *
 * POST /payments/orders  — Create a Razorpay order for a confirmed booking
 * POST /payments/verify  — Verify payment signature from client Razorpay Checkout callback
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /payments/orders
   * Create a Razorpay order for an existing BOOKED booking.
   * Returns orderId, amount, currency, and keyId for client Razorpay Checkout.
   */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.createBookingOrder(dto.bookingId, user.userId);
  }

  /**
   * POST /payments/product-orders
   * Create a Razorpay order for a pending ProductOrder (B2B marketplace checkout).
   * Returns orderId, amount, currency, and keyId for client Razorpay Checkout.
   * notes.type='MARKETPLACE_SALE' ensures correct webhook routing.
   */
  @Post('product-orders')
  @Roles('PLANNER', 'CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  createProductOrderPayment(
    @Body() dto: CreateProductOrderPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentService.createProductOrderPayment(dto.orderId, user.userId);
  }

  /**
   * POST /payments/verify
   * Verify Razorpay payment signature after client Checkout callback.
   * Optimistically updates booking paymentStatus for immediate UX feedback.
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentService.verifyPayment(dto);
  }
}
