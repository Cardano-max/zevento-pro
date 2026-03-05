import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class GrantConsentDto {
  @IsIn(['PHONE_REVEAL', 'LEAD_CREATION', 'DATA_PROCESSING'])
  consentType: string;

  @IsUUID()
  @IsOptional()
  targetUserId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
