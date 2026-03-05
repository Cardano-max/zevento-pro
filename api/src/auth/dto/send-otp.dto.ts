import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+91[0-9]{10}$/, {
    message: 'phone must be a valid Indian phone number in format +91XXXXXXXXXX',
  })
  phone: string;
}
