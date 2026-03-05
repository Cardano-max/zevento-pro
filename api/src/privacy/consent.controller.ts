import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Post } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsentService } from './consent.service';
import { AuditLogService } from './audit-log.service';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { RevokeConsentDto } from './dto/revoke-consent.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    activeRole?: string;
    role?: string;
  };
}

@Controller('privacy')
@UseGuards(JwtAuthGuard)
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('consent')
  async grantConsent(
    @Body() dto: GrantConsentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] ?? undefined;

    return this.consentService.grantConsent({
      userId: req.user.id,
      consentType: dto.consentType,
      targetUserId: dto.targetUserId,
      ipAddress,
      userAgent,
      metadata: dto.metadata,
    });
  }

  @Delete('consent')
  async revokeConsent(
    @Body() dto: RevokeConsentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers['user-agent'] ?? undefined;

    return this.consentService.revokeConsent({
      userId: req.user.id,
      consentType: dto.consentType,
      targetUserId: dto.targetUserId,
      ipAddress,
      userAgent,
    });
  }

  @Get('consent/status')
  async checkConsentStatus(
    @Query('type') type: string,
    @Query('targetUserId') targetUserId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const hasConsent = await this.consentService.hasActiveConsent(
      req.user.id,
      type,
      targetUserId,
    );

    if (!hasConsent) {
      return { hasConsent: false };
    }

    const history = await this.consentService.getConsentHistory(req.user.id, type);
    const granted = history.find(
      (r) =>
        r.status === 'GRANTED' &&
        (!targetUserId || (r.metadata as any)?.targetUserId === targetUserId),
    );

    return {
      hasConsent: true,
      grantedAt: granted?.createdAt,
    };
  }

  @Get('consent/history')
  async getConsentHistory(
    @Query('type') type: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.consentService.getConsentHistory(req.user.id, type);
  }

  // -------------------------
  // Admin audit endpoints
  // -------------------------

  @Get('audit-trail')
  async getAuditTrail(
    @Query('userId') userId?: string,
    @Query('targetUserId') targetUserId?: string,
    @Query('consentType') consentType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.getAuditTrail({
      userId,
      targetUserId,
      consentType,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('audit-trail/user/:userId')
  async getAuditTrailForUser(@Param('userId') userId: string) {
    return this.auditLogService.getAuditTrail({
      userId,
      page: 1,
      limit: 100,
    });
  }

  @Get('audit-trail/reveals')
  async getRevealAuditTrail() {
    return this.auditLogService.getAuditTrail({
      consentType: 'PHONE_REVEAL',
      page: 1,
      limit: 100,
    });
  }
}
