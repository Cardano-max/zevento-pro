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
