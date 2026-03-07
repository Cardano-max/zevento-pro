import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateInquiryDto {
  @IsString()
  eventType: string;

  @IsDateString()
  eventDate: string;

  @IsString()
  city: string;

  @IsInt()
  @Min(1)
  budget: number; // in paise

  @IsInt()
  @Min(1)
  guestCount: number;

  /** Mode A: specific vendor profile inquiry */
  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => !o.categoryId)
  targetVendorId?: string;

  /** Mode B: category-based inquiry */
  @IsUUID()
  @IsOptional()
  @ValidateIf((o) => !o.targetVendorId)
  categoryId?: string;

  /** DPDP Act consent flag -- must be true to create lead (PRIV-02) */
  @IsBoolean()
  consentGiven: boolean;
}
