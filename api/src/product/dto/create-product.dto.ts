import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { FulfillmentSource } from '@zevento/shared';

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(100)
  pricePaise: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  moq?: number = 1;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FulfillmentSource)
  fulfillmentSource?: FulfillmentSource;
}
