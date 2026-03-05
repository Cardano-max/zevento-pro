export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string; // ConsentType enum value
  status: string; // ConsentStatus enum value
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ConsentCheckResult {
  hasConsent: boolean;
  grantedAt?: Date;
  consentType: string;
}
