import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class DeclineLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
