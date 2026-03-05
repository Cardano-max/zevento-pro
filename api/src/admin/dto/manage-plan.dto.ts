import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum VendorRole {
  PLANNER = 'PLANNER',
  SUPPLIER = 'SUPPLIER',
}

export enum PlanTier {
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
}

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum(VendorRole, {
    message: 'vendorRole must be one of: PLANNER, SUPPLIER',
  })
  vendorRole: VendorRole;

  @IsEnum(PlanTier, {
    message: 'tier must be one of: BASIC, PREMIUM',
  })
  tier: PlanTier;

  @IsInt()
  @Min(100, { message: 'amountPaise must be at least 100 (1 rupee)' })
  amountPaise: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonths?: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(100, { message: 'amountPaise must be at least 100 (1 rupee)' })
  amountPaise?: number;

  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
