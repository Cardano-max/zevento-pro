import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
}
