import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great post! We can help with this.' })
  @IsString()
  @MinLength(1)
  body: string;
}
