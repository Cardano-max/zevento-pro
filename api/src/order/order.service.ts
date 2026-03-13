import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * OrderService: B2B product order placement and management.
 *
 * Core flow:
 *   1. Planner calls createOrder → atomic stock reservation in $transaction
 *   2. Planner calls PaymentService.createProductOrderPayment → Razorpay order
 *   3. Webhook captures payment → OrderPaymentProcessor creates Transaction
 *
 * Stock decrement is atomic inside $transaction. Low-stock alerts enqueued
 * OUTSIDE the transaction (consistent with Pitfall 4 — no long-running ops in $transaction).
 */
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('stock-alerts') private readonly stockAlertQueue: Queue,
  ) {}

  /**
   * Place a B2B product order with atomic stock reservation.
   *
   * 1. Validate all products belong to vendorId and are active
   * 2. Validate MOQ: each item.quantity >= product.moq
   * 3. Atomic $transaction:
   *    a. For each item: check stock >= quantity, decrement stock
   *    b. Create ProductOrder with PENDING status
   *    c. Create ProductOrderItems (unitPaise from product, totalPaise = quantity * unitPaise)
   *    d. Create initial OrderStatusHistory (fromStatus: null, toStatus: PENDING)
   * 4. Enqueue low-stock alerts for items that crossed the threshold (outside $transaction)
   * 5. Return created order with items
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const { vendorId, items, shippingAddress, note } = dto;

    // 1. Fetch all products and validate ownership + active status
    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missing = productIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Product(s) not found: ${missing.join(', ')}`,
      );
    }

    // Validate all products belong to the specified vendor
    const wrongVendor = products.filter((p) => p.vendorId !== vendorId);
    if (wrongVendor.length > 0) {
      throw new BadRequestException(
        `Product(s) do not belong to vendor ${vendorId}: ${wrongVendor.map((p) => p.name).join(', ')}`,
      );
    }

    // Validate all products are active
    const inactive = products.filter((p) => !p.isActive);
    if (inactive.length > 0) {
      throw new BadRequestException(
        `Product(s) are not available: ${inactive.map((p) => p.name).join(', ')}`,
      );
    }

    // Build a map for quick lookups
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 2. Validate MOQ
    for (const item of items) {
      const product = productMap.get(item.productId)!;
      if (item.quantity < product.moq) {
        throw new BadRequestException(
          `Minimum order quantity for "${product.name}" is ${product.moq}. You ordered ${item.quantity}.`,
        );
      }
    }

    // 3. Calculate server-side total (NEVER accept from client — 04-02 decision)
    const totalPaise = items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + item.quantity * product.pricePaise;
    }, 0);

    // 4. Atomic $transaction: stock check + decrement + order creation
    const order = await this.prisma.$transaction(async (tx) => {
      // Check and decrement stock for each item atomically
      const updatedProducts: Array<{
        id: string;
        stock: number;
        lowStockThreshold: number;
      }> = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, stock: true, lowStockThreshold: true },
        });

        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${productMap.get(item.productId)!.name}". Available: ${product.stock}, requested: ${item.quantity}.`,
          );
        }

        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
          select: { id: true, stock: true, lowStockThreshold: true },
        });

        updatedProducts.push(updated);
      }

      // Create ProductOrder
      const createdOrder = await tx.productOrder.create({
        data: {
          buyerId,
          vendorId,
          status: 'PENDING',
          totalPaise,
          shippingAddress,
          note,
          items: {
            create: items.map((item) => {
              const product = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPaise: product.pricePaise,
                totalPaise: item.quantity * product.pricePaise,
              };
            }),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: 'PENDING',
            },
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, pricePaise: true },
              },
            },
          },
          vendor: { select: { id: true, businessName: true } },
        },
      });

      return { createdOrder, updatedProducts };
    });

    // 5. Enqueue low-stock alerts OUTSIDE transaction (Pitfall 4: no long-running ops in $transaction)
    for (const updated of order.updatedProducts) {
      if (updated.stock <= updated.lowStockThreshold) {
        await this.stockAlertQueue.add('low-stock', {
          productId: updated.id,
          currentStock: updated.stock,
        });
        this.logger.log(
          `Low stock alert enqueued: product=${updated.id}, stock=${updated.stock}, threshold=${updated.lowStockThreshold}`,
        );
      }
    }

    this.logger.log(
      `Order created: ${order.createdOrder.id}, buyer=${buyerId}, vendor=${vendorId}, total=${totalPaise}`,
    );

    return order.createdOrder;
  }

  /**
   * Fetch full order detail by ID.
   * Includes items with product info, vendor, and buyer info.
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.productOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                pricePaise: true,
                images: {
                  take: 1,
                  orderBy: { sortOrder: 'asc' },
                  select: { cloudinaryUrl: true },
                },
              },
            },
          },
        },
        vendor: { select: { id: true, businessName: true } },
        buyer: { select: { id: true, phone: true } },
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get a planner's order history, paginated.
   * Includes vendor businessName, item count, totalPaise, status.
   */
  async getMyOrders(buyerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.productOrder.findMany({
        where: { buyerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { id: true, businessName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.productOrder.count({ where: { buyerId } }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a supplier's incoming orders, paginated with optional status filter.
   * Includes buyer info, item count, totalPaise, status, createdAt.
   */
  async getVendorOrders(
    vendorId: string,
    page: number,
    limit: number,
    status?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { vendorId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.productOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, phone: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.productOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cancel a PENDING or CONFIRMED order.
   * Verifies requester is buyer or vendor owner. Restores stock. Creates status history.
   * If payment was already captured, a refund must be initiated separately (Phase 5 refund flow).
   */
  async cancelOrder(
    orderId: string,
    requesterId: string,
    requesterRole: string,
  ) {
    const order = await this.prisma.productOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        vendor: { select: { id: true, userId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify requester has permission (buyer, vendor owner, or admin)
    const isBuyer = order.buyerId === requesterId;
    const isVendorOwner = order.vendor.userId === requesterId;
    const isAdmin = requesterRole === 'ADMIN';

    if (!isBuyer && !isVendorOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to cancel this order');
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled in status: ${order.status}. Only PENDING or CONFIRMED orders can be cancelled.`,
      );
    }

    // Restore stock for each item
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.productOrder.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          note:
            order.paymentStatus === 'CAPTURED'
              ? 'Order cancelled. Payment was captured — refund must be initiated separately through admin.'
              : undefined,
        },
      });
    });

    this.logger.log(
      `Order ${orderId} cancelled by ${requesterId} (role: ${requesterRole})`,
    );

    return { cancelled: true, orderId };
  }
}
