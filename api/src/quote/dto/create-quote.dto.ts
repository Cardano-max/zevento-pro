import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LineItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsInt()
  @Min(1)
  amountPaise: number; // in paise

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number; // defaults to 1
}

export class CreateQuoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  @IsDate()
  @Type(() => Date)
  validUntil: Date; // quote validity deadline

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
