import { Role, MarketStatus, ConsentType, ConsentStatus } from '../enums';

export interface UserBase {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  role: Role;
  contextId: string | null;
  isActive: boolean;
  grantedAt: Date;
  grantedBy: string | null;
  revokedAt: Date | null;
}

export interface Market {
  id: string;
  city: string;
  state: string;
  status: MarketStatus;
  launchDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsentLog {
  id: string;
  userId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface UserWithRoles extends UserBase {
  roles: UserRole[];
}
