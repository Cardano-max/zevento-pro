export enum Role {
  CUSTOMER = 'CUSTOMER',
  PLANNER = 'PLANNER',
  SUPPLIER = 'SUPPLIER',
  ADMIN = 'ADMIN',
}

export enum MarketStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
}

export enum ConsentType {
  PHONE_REVEAL = 'PHONE_REVEAL',
  LEAD_CREATION = 'LEAD_CREATION',
  DATA_PROCESSING = 'DATA_PROCESSING',
}

export enum ConsentStatus {
  GRANTED = 'GRANTED',
  REVOKED = 'REVOKED',
}

export enum WebhookEventStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

// Phase 2: Vendor Onboarding & Subscriptions

export enum OnboardingStep {
  REGISTERED = 1,
  BUSINESS_DETAILS = 2,
  PORTFOLIO = 3,
  SERVICE_AREA = 4,
  KYC_SUBMITTED = 5,
}

export enum VendorStatus {
  DRAFT = 'DRAFT',
  PENDING_KYC = 'PENDING_KYC',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum KycDocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  GST_CERTIFICATE = 'GST_CERTIFICATE',
}

export enum SubscriptionTier {
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionStatus {
  CREATED = 'CREATED',
  AUTHENTICATED = 'AUTHENTICATED',
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  HALTED = 'HALTED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum TransactionType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  LEAD_PURCHASE = 'LEAD_PURCHASE',
  BOOKING_COMMISSION = 'BOOKING_COMMISSION',
  MARKETPLACE_SALE = 'MARKETPLACE_SALE',
}

export enum TransactionStatus {
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum AdminNotificationType {
  KYC_SUBMISSION = 'KYC_SUBMISSION',
  DISPUTE = 'DISPUTE',
}

// Phase 3: Lead Routing Engine

export enum LeadStatus {
  PENDING = 'PENDING',
  ROUTING = 'ROUTING',
  ROUTED = 'ROUTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum LeadAssignmentStatus {
  PENDING = 'PENDING',
  NOTIFIED = 'NOTIFIED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

// Phase 5: Payments and Commission Settlement

export enum PaymentStatus {
  PENDING = 'PENDING',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  REVERSED = 'REVERSED',
  FAILED = 'FAILED',
  PENDING_BANK_DETAILS = 'PENDING_BANK_DETAILS',
}

// Phase 6: B2B Product Marketplace

export enum ProductOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DISPATCHED = 'DISPATCHED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum FulfillmentSource {
  SUPPLIER = 'SUPPLIER',
  ZEVENTO = 'ZEVENTO',
}
