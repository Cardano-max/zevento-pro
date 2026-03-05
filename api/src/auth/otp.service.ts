import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

@Injectable()
export class OtpService {
  constructor(private readonly redis: RedisService) {}

  generateOtp(): string {
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
    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored) {
      return false;
    }

    const submittedHash = this.hashOtp(submittedOtp);

    if (stored === submittedHash) {
      // Delete on successful verification — prevent replay attacks
      await this.redis.del(`otp:${phone}`);
      return true;
    }

    // Increment failed attempt counter
    const failedKey = `otp:failed:${phone}`;
    const count = await this.redis.incr(failedKey);
    if (count === 1) {
      // Set TTL on first failure — window is 1 hour
      await this.redis.expire(failedKey, 3600);
    }

    return false;
  }
}
