import { SetMetadata } from '@nestjs/common';

export const CONSENT_KEY = 'requires_consent';

export interface ConsentMetadata {
  consentType: string;
  targetUserIdParam: string;
}

/**
 * Decorator that marks an endpoint as requiring active consent before access.
 * Used with ConsentRequiredGuard.
 *
 * @param consentType - The consent type required (e.g., 'PHONE_REVEAL')
 * @param targetUserIdParam - Route/query param name containing the target user ID (default: 'userId')
 *
 * @example
 * @RequiresConsent('PHONE_REVEAL')
 * @Get(':userId/phone')
 * async getPhone(@Param('userId') userId: string) { ... }
 */
export const RequiresConsent = (
  consentType: string,
  targetUserIdParam = 'userId',
) =>
  SetMetadata(CONSENT_KEY, {
    consentType,
    targetUserIdParam,
  } as ConsentMetadata);
