import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

const OTP_TTL_SECONDS = 10 * 60;
const BYPASS_CODE = process.env.OTP_BYPASS_CODE ?? '999999';

@Injectable()
export class OtpService {
  constructor(private readonly redis: RedisService) {}

  generateOtp(): string {
    if (process.env.OTP_BYPASS_CODE) return BYPASS_CODE;
    return crypto.randomInt(100000, 999999).toString();
  }

  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  async storeOtp(phone: string, otp: string): Promise<void> {
    const hashed = this.hashOtp(otp);
    await this.redis.set(`otp:${phone}`, hashed, OTP_TTL_SECONDS);
  }

  async verifyOtp(phone: string, submittedOtp: string): Promise<boolean> {
    // Bypass: always accept the bypass code
    if (process.env.OTP_BYPASS_CODE && submittedOtp === BYPASS_CODE) {
      return true;
    }

    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored) return false;

    const submittedHash = this.hashOtp(submittedOtp);
    if (stored === submittedHash) {
      await this.redis.del(`otp:${phone}`);
      return true;
    }

    const failedKey = `otp:failed:${phone}`;
    const count = await this.redis.incr(failedKey);
    if (count === 1) await this.redis.expire(failedKey, 3600);

    return false;
  }
}
