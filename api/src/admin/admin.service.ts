import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/manage-category.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/manage-plan.dto';
import { KycAction, ReviewKycDto } from './dto/review-kyc.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async assignRole(
    userId: string,
    role: string,
    grantedBy: string,
    contextId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Check if active role already assigned
    const existing = user.roles.find(
      (r) =>
        r.role === role &&
        r.isActive &&
        r.contextId === (contextId ?? null),
    );

    if (existing) {
      throw new BadRequestException(
        `User already has active role: ${role}`,
      );
    }

    await this.prisma.userRole.create({
      data: {
        userId,
        role,
        contextId: contextId ?? null,
        grantedBy,
      },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
  }

  async revokeRole(userId: string, roleId: string, revokedBy: string) {
    const userRole = await this.prisma.userRole.findUnique({
      where: { id: roleId },
    });

    if (!userRole) {
      throw new NotFoundException(`Role assignment ${roleId} not found`);
    }

    if (userRole.userId !== userId) {
      throw new NotFoundException(`Role ${roleId} does not belong to user ${userId}`);
    }

    await this.prisma.userRole.update({
      where: { id: roleId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
  }

  async listUsers(page = 1, limit = 20, roleFilter?: string) {
    const skip = (page - 1) * limit;

    const where = roleFilter
      ? {
          roles: {
            some: {
              role: roleFilter,
              isActive: true,
            },
          },
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { roles: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }

  // ──────────────────────────────────────────────────
  // KYC Review Queue
  // ──────────────────────────────────────────────────

  async getKycQueue(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { status: status || 'PENDING_KYC' };

    const [data, total] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, name: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
          serviceAreas: { include: { market: { select: { id: true, city: true } } } },
          kycDocuments: true,
          _count: { select: { photos: true } },
        },
        skip,
        take: limit,
        orderBy: { submittedAt: 'asc' },
      }),
      this.prisma.vendorProfile.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getVendorDetail(vendorId: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: {
        user: true,
        categories: { include: { category: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        serviceAreas: { include: { market: true } },
        kycDocuments: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    return vendor;
  }

  async reviewKyc(vendorId: string, dto: ReviewKycDto, adminUserId: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    if (vendor.status !== 'PENDING_KYC') {
      throw new BadRequestException(
        `Vendor status is ${vendor.status}, expected PENDING_KYC`,
      );
    }

    if (dto.action === KycAction.REJECT && !dto.rejectionReason?.trim()) {
      throw new BadRequestException(
        'rejectionReason is required when rejecting a KYC application',
      );
    }

    const updateData =
      dto.action === KycAction.APPROVE
        ? {
            status: 'APPROVED',
            approvedAt: new Date(),
            rejectionReason: null,
          }
        : {
            status: 'REJECTED',
            rejectionReason: dto.rejectionReason,
          };

    const [updatedVendor] = await this.prisma.$transaction([
      this.prisma.vendorProfile.update({
        where: { id: vendorId },
        data: updateData,
        include: { user: { select: { id: true, phone: true, name: true } } },
      }),
      this.prisma.adminNotification.create({
        data: {
          type: 'KYC_REVIEW',
          title: `KYC ${dto.action === KycAction.APPROVE ? 'Approved' : 'Rejected'}: ${vendor.businessName}`,
          message: dto.action === KycAction.APPROVE
            ? `Vendor "${vendor.businessName}" KYC approved by admin`
            : `Vendor "${vendor.businessName}" KYC rejected: ${dto.rejectionReason}`,
          referenceId: vendorId,
        },
      }),
    ]);

    return updatedVendor;
  }

  async suspendVendor(vendorId: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    return this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: { status: 'SUSPENDED' },
      include: { user: { select: { id: true, phone: true, name: true } } },
    });
  }

  async reactivateVendor(vendorId: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor ${vendorId} not found`);
    }

    if (vendor.status !== 'SUSPENDED') {
      throw new BadRequestException(
        `Vendor status is ${vendor.status}, expected SUSPENDED for reactivation`,
      );
    }

    return this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: { status: 'APPROVED' },
      include: { user: { select: { id: true, phone: true, name: true } } },
    });
  }

  async listVendors(status?: string, role?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (role) where.role = role;

    const [data, total] = await Promise.all([
      this.prisma.vendorProfile.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, name: true } },
          subscription: { select: { status: true, plan: { select: { name: true, tier: true } } } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorProfile.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ──────────────────────────────────────────────────
  // Event Category Management
  // ──────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async createCategory(dto: CreateCategoryDto) {
    const slug = this.generateSlug(dto.name);

    const existing = await this.prisma.eventCategory.findFirst({
      where: { OR: [{ name: dto.name }, { slug }] },
    });

    if (existing) {
      throw new ConflictException(
        `Category with name "${dto.name}" already exists`,
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.eventCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent category ${dto.parentId} not found`);
      }
    }

    return this.prisma.eventCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      const slug = this.generateSlug(dto.name);

      const existing = await this.prisma.eventCategory.findFirst({
        where: {
          OR: [{ name: dto.name }, { slug }],
          NOT: { id: categoryId },
        },
      });

      if (existing) {
        // Try with numeric suffix
        let uniqueSlug = slug;
        let suffix = 2;
        while (true) {
          const conflict = await this.prisma.eventCategory.findUnique({
            where: { slug: uniqueSlug },
          });
          if (!conflict || conflict.id === categoryId) break;
          uniqueSlug = `${slug}-${suffix}`;
          suffix++;
        }

        // Name must still be unique
        if (existing.name === dto.name) {
          throw new ConflictException(
            `Category with name "${dto.name}" already exists`,
          );
        }

        updateData.slug = uniqueSlug;
      } else {
        updateData.slug = slug;
      }

      updateData.name = dto.name;
    }

    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.prisma.eventCategory.update({
      where: { id: categoryId },
      data: updateData,
    });
  }

  async listCategories(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    return this.prisma.eventCategory.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, slug: true, isActive: true } },
        _count: { select: { vendors: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCategoryDetail(categoryId: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, slug: true, isActive: true, sortOrder: true } },
        _count: { select: { vendors: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }

    return category;
  }

  // ──────────────────────────────────────────────────
  // Subscription Plan Management
  // ──────────────────────────────────────────────────

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: {
        vendorRole_tier: {
          vendorRole: dto.vendorRole,
          tier: dto.tier,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Plan for ${dto.vendorRole} ${dto.tier} already exists`,
      );
    }

    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        vendorRole: dto.vendorRole,
        tier: dto.tier,
        amountPaise: dto.amountPaise,
        periodMonths: dto.periodMonths ?? 1,
        features: dto.features
          ? (dto.features as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async updatePlan(planId: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.features !== undefined) updateData.features = dto.features;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (dto.amountPaise !== undefined) {
      updateData.amountPaise = dto.amountPaise;
      // Razorpay plans are immutable — price change requires new plan
      if (plan.razorpayPlanId && dto.amountPaise !== plan.amountPaise) {
        updateData.razorpayPlanId = null;
      }
    }

    return this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
    });
  }

  async listPlans(vendorRole?: string, includeInactive = false) {
    const where: Record<string, unknown> = {};
    if (vendorRole) where.vendorRole = vendorRole;
    if (!includeInactive) where.isActive = true;

    return this.prisma.subscriptionPlan.findMany({
      where,
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: [{ vendorRole: 'asc' }, { tier: 'asc' }],
    });
  }

  async getPlanDetail(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }

    return plan;
  }

  // ──────────────────────────────────────────────────
  // Admin Notifications
  // ──────────────────────────────────────────────────

  async getNotifications(page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit;
    const where = unreadOnly ? { isRead: false } : {};

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminNotification.count({ where }),
      this.prisma.adminNotification.count({ where: { isRead: false } }),
    ]);

    return { data, total, unreadCount, page, totalPages: Math.ceil(total / limit) };
  }

  async markNotificationRead(notificationId: string) {
    const notification = await this.prisma.adminNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    return this.prisma.adminNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllNotificationsRead() {
    const result = await this.prisma.adminNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return { count: result.count };
  }

  async getUnreadCount() {
    const count = await this.prisma.adminNotification.count({
      where: { isRead: false },
    });

    return { unreadCount: count };
  }
}
