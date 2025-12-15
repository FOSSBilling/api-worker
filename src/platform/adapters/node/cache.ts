// Reference implementations for Node.js cache
// Install ioredis: npm install ioredis @types/ioredis

import { ICache, CacheOptions } from "../../interfaces";

export class InMemoryCacheAdapter implements ICache {
  private store = new Map<string, { value: string; expiry?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(key: string, value: string, options?: CacheOptions): Promise<void> {
    let expiry: number | undefined;

    if (options?.expirationTtl) {
      expiry = Date.now() + options.expirationTtl * 1000;
    } else if (options?.expiration) {
      expiry = options.expiration * 1000;
    }

    this.store.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class RedisAdapter implements ICache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private redis: any) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async put(key: string, value: string, options?: CacheOptions): Promise<void> {
    if (options?.expirationTtl) {
      await this.redis.setex(key, options.expirationTtl, value);
    } else if (options?.expiration) {
      const ttl = options.expiration - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } else {
      await this.redis.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
