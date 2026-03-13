import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchProductsDto } from './dto/search-products.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search products with optional filters: category, price range, keyword, vendor.
   * Only returns active products from approved vendors with active subscriptions.
   */
  async searchProducts(dto: SearchProductsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      vendor: {
        status: 'APPROVED',
        subscription: {
          status: { in: ['ACTIVE', 'AUTHENTICATED'] },
        },
      },
    };

    // Keyword search on product name
    if (dto.search) {
      where.name = { contains: dto.search, mode: 'insensitive' };
    }

    // Category filter
    if (dto.categoryId) {
      where.categoryId = dto.categoryId;
    }

    // Price range filters
    if (dto.priceMin !== undefined) {
      where.pricePaise = {
        ...(where.pricePaise as Prisma.IntFilter),
        gte: dto.priceMin,
      };
    }

    if (dto.priceMax !== undefined) {
      where.pricePaise = {
        ...(where.pricePaise as Prisma.IntFilter),
        lte: dto.priceMax,
      };
    }

    // Vendor filter
    if (dto.vendorId) {
      where.vendorId = dto.vendorId;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          pricePaise: true,
          stock: true,
          moq: true,
          fulfillmentSource: true,
          category: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, businessName: true } },
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { id: true, cloudinaryUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full product detail by ID.
   * Only returns active products. Throws 404 if not found or inactive.
   */
  async getProductDetail(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, businessName: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            cloudinaryUrl: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  /**
   * List all active product categories with one level of children.
   */
  async getCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        parentId: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            sortOrder: true,
          },
        },
      },
    });
  }
}
