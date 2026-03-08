import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockDateDto {
  @IsDateString()
  date: string; // ISO date string e.g. "2026-03-15" — stored as @db.Date

  @IsString()
  @IsOptional()
  @MaxLength(100)
  reason?: string;
}
