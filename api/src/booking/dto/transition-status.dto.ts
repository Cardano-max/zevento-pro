import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransitionStatusDto {
  @IsString()
  @IsIn(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}
