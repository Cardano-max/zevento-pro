import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Fully implemented in plan 01-03 Task 2
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logContactReveal(params: {
    viewerUserId: string;
    viewerRole: string;
    targetUserId: string;
    targetField: string;
    accessGranted: boolean;
    ipAddress?: string;
    timestamp: Date;
  }): Promise<void> {
    await this.prisma.consentLog.create({
      data: {
        userId: params.viewerUserId,
        consentType: 'PHONE_REVEAL',
        status: params.accessGranted ? 'GRANTED' : 'REVOKED',
        ipAddress: params.ipAddress ?? null,
        metadata: {
          auditEvent: 'contact_reveal',
          viewerRole: params.viewerRole,
          targetUserId: params.targetUserId,
          targetField: params.targetField,
          accessGranted: params.accessGranted,
          timestamp: params.timestamp.toISOString(),
        },
      },
    });
  }

  async getAuditTrail(filters: {
    userId?: string;
    targetUserId?: string;
    consentType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page: number;
    limit: number;
  }) {
    const where: Record<string, any> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.consentType) where.consentType = filters.consentType;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [records, total] = await Promise.all([
      this.prisma.consentLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.consentLog.count({ where }),
    ]);

    // Post-filter by targetUserId from metadata if specified
    const filtered = filters.targetUserId
      ? records.filter((r) => {
          const meta = r.metadata as Record<string, any> | null;
          return meta?.targetUserId === filters.targetUserId;
        })
      : records;

    return {
      data: filtered,
      total,
      page: filters.page,
      limit: filters.limit,
      pages: Math.ceil(total / filters.limit),
    };
  }

  async getRevealHistory(targetUserId: string) {
    const records = await this.prisma.consentLog.findMany({
      where: {
        consentType: 'PHONE_REVEAL',
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.filter((r) => {
      const meta = r.metadata as Record<string, any> | null;
      return (
        meta?.targetUserId === targetUserId || meta?.auditEvent === 'contact_reveal'
          ? meta?.targetUserId === targetUserId
          : false
      );
    });
  }

  async exportAuditLog(
    filters: {
      userId?: string;
      targetUserId?: string;
      consentType?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    format: 'json',
  ) {
    const result = await this.getAuditTrail({
      ...filters,
      page: 1,
      limit: 10000,
    });
    return result.data;
  }
}
