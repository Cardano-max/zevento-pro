import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CONSENT_KEY,
  ConsentMetadata,
} from '../decorators/requires-consent.decorator';
import { ConsentService } from '../consent.service';
import { AuditLogService } from '../audit-log.service';

@Injectable()
export class ConsentRequiredGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly consentService: ConsentService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const consentMeta = this.reflector.getAllAndOverride<
      ConsentMetadata | undefined
    >(CONSENT_KEY, [context.getHandler(), context.getClass()]);

    // No consent metadata — not a consent-gated endpoint
    if (!consentMeta) return true;

    const request = context.switchToHttp().getRequest();
    const viewer = request.user as
      | { id: string; activeRole?: string; role?: string }
      | undefined;

    if (!viewer) {
      throw new ForbiddenException('Authentication required');
    }

    const viewerRole = viewer.activeRole ?? viewer.role ?? 'CUSTOMER';

    // ADMIN bypasses consent check
    if (viewerRole === 'ADMIN') return true;

    // Extract target user ID from params or query
    const targetUserId =
      request.params?.[consentMeta.targetUserIdParam] ??
      request.query?.[consentMeta.targetUserIdParam];

    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      undefined;

    const hasConsent = await this.consentService.hasActiveConsent(
      targetUserId,
      consentMeta.consentType,
      viewer.id,
    );

    // Log the access attempt regardless of outcome
    await this.auditLogService.logContactReveal({
      viewerUserId: viewer.id,
      viewerRole,
      targetUserId: targetUserId ?? 'unknown',
      targetField: 'phone',
      accessGranted: hasConsent,
      ipAddress,
      timestamp: new Date(),
    });

    if (!hasConsent) {
      throw new ForbiddenException(
        'Consent required to access this data. Please request consent first.',
      );
    }

    return true;
  }
}
