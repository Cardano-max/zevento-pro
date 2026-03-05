import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServiceAreaItemDto {
  @IsUUID('4')
  marketId: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  radiusKm?: number = 25;
}

export class UpdateServiceAreaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaItemDto)
  serviceAreas: ServiceAreaItemDto[];
}
