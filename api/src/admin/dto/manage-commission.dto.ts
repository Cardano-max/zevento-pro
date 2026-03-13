import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateCommissionRateDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['PLANNER', 'SUPPLIER'])
  vendorRole?: string;

  @IsInt()
  @Min(100) // minimum 1% (100 bps)
  @Max(3000) // maximum 30% (3000 bps)
  rateBps: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateCommissionRateDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(3000)
  rateBps?: number;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
