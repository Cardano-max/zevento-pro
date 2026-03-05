import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentRecord, ConsentCheckResult } from '@zevento/shared';

@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async grantConsent(params: {
    userId: string;
    consentType: string;
    targetUserId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<ConsentRecord> {
    const metadataPayload: Record<string, any> = { ...(params.metadata ?? {}) };
    if (params.targetUserId) {
      metadataPayload.targetUserId = params.targetUserId;
    }

    const record = await this.prisma.consentLog.create({
      data: {
        userId: params.userId,
        consentType: params.consentType,
        status: 'GRANTED',
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : undefined,
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      consentType: record.consentType,
      status: record.status,
      ipAddress: record.ipAddress ?? undefined,
      userAgent: record.userAgent ?? undefined,
      metadata: (record.metadata as Record<string, any>) ?? undefined,
      createdAt: record.createdAt,
    };
  }

  async revokeConsent(params: {
    userId: string;
    consentType: string;
    targetUserId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ConsentRecord> {
    const metadataPayload: Record<string, any> = {};
    if (params.targetUserId) {
      metadataPayload.targetUserId = params.targetUserId;
    }

    const record = await this.prisma.consentLog.create({
      data: {
        userId: params.userId,
        consentType: params.consentType,
        status: 'REVOKED',
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: Object.keys(metadataPayload).length > 0 ? metadataPayload : undefined,
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      consentType: record.consentType,
      status: record.status,
      ipAddress: record.ipAddress ?? undefined,
      userAgent: record.userAgent ?? undefined,
      metadata: (record.metadata as Record<string, any>) ?? undefined,
      createdAt: record.createdAt,
    };
  }

  async hasActiveConsent(
    userId: string,
    consentType: string,
    targetUserId?: string,
  ): Promise<boolean> {
    const records = await this.prisma.consentLog.findMany({
      where: {
        userId,
        consentType,
      },
      orderBy: { createdAt: 'desc' },
    });

    const filtered = targetUserId
      ? records.filter((r) => {
          const meta = r.metadata as Record<string, any> | null;
          return meta?.targetUserId === targetUserId;
        })
      : records;

    if (filtered.length === 0) return false;
    return filtered[0].status === 'GRANTED';
  }

  async getConsentHistory(
    userId: string,
    consentType?: string,
  ): Promise<ConsentRecord[]> {
    const records = await this.prisma.consentLog.findMany({
      where: {
        userId,
        ...(consentType ? { consentType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      consentType: r.consentType,
      status: r.status,
      ipAddress: r.ipAddress ?? undefined,
      userAgent: r.userAgent ?? undefined,
      metadata: (r.metadata as Record<string, any>) ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async hasPhoneRevealConsent(
    customerId: string,
    vendorId: string,
  ): Promise<ConsentCheckResult> {
    const hasConsent = await this.hasActiveConsent(
      customerId,
      'PHONE_REVEAL',
      vendorId,
    );

    if (!hasConsent) {
      return { hasConsent: false, consentType: 'PHONE_REVEAL' };
    }

    const records = await this.prisma.consentLog.findMany({
      where: {
        userId: customerId,
        consentType: 'PHONE_REVEAL',
        status: 'GRANTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    const match = records.find((r) => {
      const meta = r.metadata as Record<string, any> | null;
      return meta?.targetUserId === vendorId;
    });

    return {
      hasConsent: true,
      grantedAt: match?.createdAt,
      consentType: 'PHONE_REVEAL',
    };
  }
}
