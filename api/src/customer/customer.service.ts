import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchVendorsDto } from './dto/search-vendors.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all active event categories ordered by sortOrder.
   * Includes children for hierarchy.
   */
  async listCategories() {
    return this.prisma.eventCategory.findMany({
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

  /**
   * Search vendors with optional filters: categoryId, city, budget range.
   * Only returns APPROVED vendors with active subscriptions.
   */
  async searchVendors(dto: SearchVendorsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorProfileWhereInput = {
      status: 'APPROVED',
      subscription: {
        status: { in: ['ACTIVE', 'AUTHENTICATED'] },
      },
    };

    // Filter by category
    if (dto.categoryId) {
      where.categories = {
        some: { categoryId: dto.categoryId },
      };
    }

    // Filter by city (case-insensitive via Market)
    if (dto.city) {
      where.serviceAreas = {
        some: {
          market: {
            city: { equals: dto.city, mode: 'insensitive' },
          },
        },
      };
    }

    // Filter by budget range
    if (dto.budgetMin !== undefined) {
      where.pricingMin = { gte: dto.budgetMin };
    }
    if (dto.budgetMax !== undefined) {
      where.pricingMax = { lte: dto.budgetMax };
    }

    const [vendors, total] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          businessName: true,
          description: true,
          pricingMin: true,
          pricingMax: true,
          categories: {
            select: {
              category: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          serviceAreas: {
            select: {
              market: {
                select: { id: true, city: true, state: true },
              },
            },
          },
          stats: {
            select: { averageRating: true },
          },
          photos: {
            select: { id: true },
          },
        },
        orderBy: { businessName: 'asc' },
      }),
      this.prisma.vendorProfile.count({ where }),
    ]);

    // Transform for cleaner response
    const data = vendors.map((vendor) => ({
      id: vendor.id,
      businessName: vendor.businessName,
      description: vendor.description,
      pricingMin: vendor.pricingMin,
      pricingMax: vendor.pricingMax,
      categories: vendor.categories.map((vc) => vc.category.name),
      serviceAreas: vendor.serviceAreas.map((sa) => sa.market.city),
      averageRating: vendor.stats?.averageRating ?? null,
      portfolioPhotoCount: vendor.photos.length,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full vendor profile by ID.
   * Only returns APPROVED vendors. Throws 404 for non-existent or non-approved.
   */
  async getVendorProfile(vendorId: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        businessName: true,
        description: true,
        pricingMin: true,
        pricingMax: true,
        categories: {
          select: {
            category: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        photos: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            cloudinaryUrl: true,
            caption: true,
            sortOrder: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
        serviceAreas: {
          select: {
            market: {
              select: { id: true, city: true, state: true },
            },
            radiusKm: true,
          },
        },
        stats: {
          select: {
            averageRating: true,
            responseRate: true,
          },
        },
        subscription: {
          select: {
            plan: {
              select: { tier: true },
            },
          },
        },
        status: true,
      },
    });

    if (!vendor || vendor.status !== 'APPROVED') {
      throw new NotFoundException('Vendor not found');
    }

    // Transform for cleaner response
    return {
      id: vendor.id,
      businessName: vendor.businessName,
      description: vendor.description,
      pricingMin: vendor.pricingMin,
      pricingMax: vendor.pricingMax,
      categories: vendor.categories.map((vc) => ({
        id: vc.category.id,
        name: vc.category.name,
        slug: vc.category.slug,
      })),
      photos: vendor.photos.map((p) => ({
        id: p.id,
        url: p.cloudinaryUrl,
        caption: p.caption,
        sortOrder: p.sortOrder,
        category: p.category
          ? { id: p.category.id, name: p.category.name }
          : null,
      })),
      serviceAreas: vendor.serviceAreas.map((sa) => ({
        city: sa.market.city,
        state: sa.market.state,
        radiusKm: sa.radiusKm,
      })),
      averageRating: vendor.stats?.averageRating ?? null,
      responseRate: vendor.stats?.responseRate ?? null,
      subscriptionTier: vendor.subscription?.plan?.tier ?? null,
    };
  }

  // ──────────────────────────────────────────────────
  // Phase 07.2: Favorites
  // ──────────────────────────────────────────────────

  /**
   * Get all favorited vendors for a customer.
   */
  async getFavorites(userId: string) {
    const favorites = await this.prisma.favoriteVendor.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        vendor: {
          select: {
            id: true,
            businessName: true,
            description: true,
            pricingMin: true,
            pricingMax: true,
            stats: { select: { averageRating: true } },
          },
        },
      },
    });

    return favorites.map((f) => ({
      favoriteId: f.id,
      createdAt: f.createdAt,
      vendor: {
        id: f.vendor.id,
        businessName: f.vendor.businessName,
        description: f.vendor.description,
        pricingMin: f.vendor.pricingMin,
        pricingMax: f.vendor.pricingMax,
        averageRating: f.vendor.stats?.averageRating ?? null,
      },
    }));
  }

  /**
   * Add a vendor to customer's favorites.
   */
  async addFavorite(userId: string, vendorId: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const existing = await this.prisma.favoriteVendor.findUnique({
      where: { customerId_vendorId: { customerId: userId, vendorId } },
    });
    if (existing) {
      throw new ConflictException('Vendor already in favorites');
    }

    return this.prisma.favoriteVendor.create({
      data: { customerId: userId, vendorId },
      select: { id: true, createdAt: true, vendorId: true },
    });
  }

  /**
   * Remove a vendor from customer's favorites.
   */
  async removeFavorite(userId: string, vendorId: string) {
    const favorite = await this.prisma.favoriteVendor.findUnique({
      where: { customerId_vendorId: { customerId: userId, vendorId } },
    });
    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }
    await this.prisma.favoriteVendor.delete({
      where: { customerId_vendorId: { customerId: userId, vendorId } },
    });
    return { message: 'Removed from favorites' };
  }

  /**
   * Check if a vendor is in customer's favorites.
   */
  async checkFavorite(userId: string, vendorId: string) {
    const favorite = await this.prisma.favoriteVendor.findUnique({
      where: { customerId_vendorId: { customerId: userId, vendorId } },
    });
    return { isFavorited: !!favorite };
  }
}
