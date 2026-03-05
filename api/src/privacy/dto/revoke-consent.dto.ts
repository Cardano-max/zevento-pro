import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class RevokeConsentDto {
  @IsIn(['PHONE_REVEAL', 'LEAD_CREATION', 'DATA_PROCESSING'])
  consentType: string;

  @IsUUID()
  @IsOptional()
  targetUserId?: string;
}
