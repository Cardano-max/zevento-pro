import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['VENDOR', 'FEED_POST', 'MESSAGE', 'USER'] })
  @IsIn(['VENDOR', 'FEED_POST', 'MESSAGE', 'USER'])
  targetType: string;

  @ApiProperty({ example: 'uuid-of-target' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ example: 'SPAM' })
  @IsString()
  @MaxLength(100)
  reason: string;

  @ApiPropertyOptional({ example: 'This vendor is posting spam content...' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ReviewReportDto {
  @ApiProperty({ enum: ['REVIEWED', 'ACTIONED', 'DISMISSED'] })
  @IsIn(['REVIEWED', 'ACTIONED', 'DISMISSED'])
  status: string;

  @ApiPropertyOptional({ example: 'Warned the vendor about the content' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
