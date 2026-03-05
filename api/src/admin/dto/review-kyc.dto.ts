import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum KycAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewKycDto {
  @IsEnum(KycAction, {
    message: 'action must be one of: APPROVE, REJECT',
  })
  action: KycAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
