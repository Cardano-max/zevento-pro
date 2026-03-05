import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ArrayMinSize,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  categoryIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricingMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricingMax?: number;
}
