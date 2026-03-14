import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { VendorOwnerGuard } from '../vendor/guards/vendor-owner.guard';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { TransitionOrderStatusDto } from './dto/transition-order-status.dto';

/**
 * OrderController: B2B product order endpoints.
 *
 * Uses full paths per endpoint (consistent with QuoteController pattern from 04-02 decision).
 * No class-level route prefix to avoid nested route complexity.
 *
 * POST  /orders                - Planner places a new order
 * GET   /orders/mine           - Planner's order history
 * GET   /orders/vendor         - Supplier's order dashboard
 * GET   /orders/:id            - Order detail (buyer, vendor, or admin)
 * POST  /orders/:id/cancel     - Cancel a PENDING or CONFIRMED order
 * PATCH /orders/:id/status     - Supplier advances order through lifecycle
 */
@ApiTags('Orders')
@ApiBearerAuth('JWT')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * POST /orders
   * Planner places a new product order. Stock is atomically reserved.
   */
  @Post('orders')
  @Roles('PLANNER', 'CUSTOMER')
  @HttpCode(HttpStatus.CREATED)
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.createOrder(user.userId, dto);
  }

  /**
   * GET /orders/mine
   * Planner's paginated order history.
   */
  @Get('orders/mine')
  @Roles('PLANNER', 'CUSTOMER')
  getMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.orderService.getMyOrders(
      user.userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  /**
   * GET /orders/vendor
   * Supplier's order dashboard. VendorOwnerGuard attaches req.vendorId.
   */
  @Get('orders/vendor')
  @Roles('SUPPLIER')
  @UseGuards(VendorOwnerGuard)
  getVendorOrders(
    @Req() req: Request & { vendorId: string },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.orderService.getVendorOrders(
      req.vendorId,
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
    );
  }

  /**
   * GET /orders/:id
   * Order detail. Available to buyer, vendor, or admin.
   */
  @Get('orders/:id')
  @Roles('PLANNER', 'CUSTOMER', 'SUPPLIER', 'ADMIN')
  getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  /**
   * POST /orders/:id/cancel
   * Cancel a PENDING or CONFIRMED order. Restores stock.
   * Delegates to transitionOrderStatus internally.
   */
  @Post('orders/:id/cancel')
  @Roles('PLANNER', 'CUSTOMER', 'SUPPLIER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  cancelOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.cancelOrder(id, user.userId, user.activeRole);
  }

  /**
   * PATCH /orders/:id/status
   * Supplier (or admin) advances order through the lifecycle state machine:
   * PENDING → CONFIRMED → DISPATCHED → DELIVERED (+ CANCELLED from PENDING/CONFIRMED)
   *
   * Buyers can only use POST /orders/:id/cancel for cancellations.
   */
  @Patch('orders/:id/status')
  @Roles('SUPPLIER', 'PLANNER', 'CUSTOMER', 'ADMIN')
  transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.transitionOrderStatus(
      id,
      dto,
      user.userId,
      user.activeRole,
    );
  }
}
