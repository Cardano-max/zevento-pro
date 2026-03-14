import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({ example: 'Looking for a wedding photographer in Mumbai' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ example: 'We are planning a wedding in June and need a photographer...' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ enum: ['REQUIREMENT', 'OFFER', 'SHOWCASE', 'GENERAL'], default: 'GENERAL' })
  @IsOptional()
  @IsIn(['REQUIREMENT', 'OFFER', 'SHOWCASE', 'GENERAL'])
  category?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: '2026-06-15T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional({ example: 50000000, description: 'Budget in paise' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  budgetPaise?: number;
}
