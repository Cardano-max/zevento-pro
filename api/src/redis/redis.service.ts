import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private useMemory = false;
  private memStore = new Map<string, { value: string; expiresAt: number | null }>();

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — using in-memory store');
      this.useMemory = true;
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn('Redis unavailable — falling back to in-memory store');
          this.useMemory = true;
          return null;
        }
        return Math.min(times * 200, 1000);
      },
    });

    this.client.on('connect', () => this.logger.log('Connected to Redis'));
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
      this.useMemory = true;
    });

    this.client.connect().catch(() => {
      this.useMemory = true;
    });
  }

  onModuleDestroy() {
    if (this.client) this.client.disconnect();
  }

  private memGet(key: string): string | null {
    const entry = this.memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.memStore.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string): Promise<string | null> {
    if (this.useMemory || !this.client) return this.memGet(key);
    try { return await this.client.get(key); } catch { return this.memGet(key); }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.useMemory || !this.client) {
      this.memStore.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
      return;
    }
    try {
      if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
      else await this.client.set(key, value);
    } catch {
      this.memStore.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    }
  }

  async del(key: string): Promise<void> {
    this.memStore.delete(key);
    if (this.client && !this.useMemory) {
      try { await this.client.del(key); } catch { /* ignore */ }
    }
  }

  async incr(key: string): Promise<number> {
    if (this.useMemory || !this.client) {
      const cur = parseInt(this.memGet(key) ?? '0', 10) + 1;
      const existing = this.memStore.get(key);
      this.memStore.set(key, { value: String(cur), expiresAt: existing?.expiresAt ?? null });
      return cur;
    }
    try { return await this.client.incr(key); } catch {
      const cur = parseInt(this.memGet(key) ?? '0', 10) + 1;
      this.memStore.set(key, { value: String(cur), expiresAt: null });
      return cur;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const existing = this.memStore.get(key);
    if (existing) {
      this.memStore.set(key, { ...existing, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
    if (this.client && !this.useMemory) {
      try { await this.client.expire(key, ttlSeconds); } catch { /* ignore */ }
    }
  }

  async ttl(key: string): Promise<number> {
    if (this.useMemory || !this.client) {
      const entry = this.memStore.get(key);
      if (!entry?.expiresAt) return -1;
      return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    }
    try { return await this.client.ttl(key); } catch { return -1; }
  }
}
