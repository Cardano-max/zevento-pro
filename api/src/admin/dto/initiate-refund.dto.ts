import {
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class InitiateRefundDto {
  @IsUUID()
  transactionId: string;

  @IsOptional()
  @IsPositive()
  amountPaise?: number; // partial refund amount; omit for full refund

  @IsString()
  @MaxLength(500)
  reason: string;
}
