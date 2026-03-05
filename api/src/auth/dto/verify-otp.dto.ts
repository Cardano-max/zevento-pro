import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+91[0-9]{10}$/, {
    message: 'phone must be a valid Indian phone number in format +91XXXXXXXXXX',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @IsOptional()
  @IsString()
  role?: string;
}
