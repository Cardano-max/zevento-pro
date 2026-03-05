import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const RATE_LIMIT_WINDOW_SECONDS = 3600; // 1 hour
const MAX_SEND_ATTEMPTS = 5;
const MAX_VERIFY_ATTEMPTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async checkSendLimit(phone: string): Promise<RateLimitResult> {
    const key = `ratelimit:send:${phone}`;
    const current = await this.redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= MAX_SEND_ATTEMPTS) {
      const retryAfter = await this.redis.ttl(key);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: retryAfter > 0 ? retryAfter : RATE_LIMIT_WINDOW_SECONDS,
      };
    }

    // Increment and set TTL on first access
    const newCount = await this.redis.incr(key);
    if (newCount === 1) {
      await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    return {
      allowed: true,
      remainingAttempts: MAX_SEND_ATTEMPTS - newCount,
      retryAfterSeconds: 0,
    };
  }

  async checkVerifyLimit(phone: string): Promise<RateLimitResult> {
    const key = `ratelimit:verify:${phone}`;
    const current = await this.redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= MAX_VERIFY_ATTEMPTS) {
      const retryAfter = await this.redis.ttl(key);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: retryAfter > 0 ? retryAfter : RATE_LIMIT_WINDOW_SECONDS,
      };
    }

    // Increment and set TTL on first access
    const newCount = await this.redis.incr(key);
    if (newCount === 1) {
      await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    return {
      allowed: true,
      remainingAttempts: MAX_VERIFY_ATTEMPTS - newCount,
      retryAfterSeconds: 0,
    };
  }

  async resetOnSuccess(phone: string): Promise<void> {
    await this.redis.del(`ratelimit:verify:${phone}`);
  }
}
