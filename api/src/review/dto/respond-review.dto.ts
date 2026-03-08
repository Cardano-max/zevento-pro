import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RespondReviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  response: string;
}
