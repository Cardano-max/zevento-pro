import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
