import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdatePortfolioDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  caption?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
