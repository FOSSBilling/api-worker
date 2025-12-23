import { DatabaseSync } from "node:sqlite";
import { ICache, CacheOptions } from "../../interfaces";

export class SQLiteCacheAdapter implements ICache {
  private db: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.db = database;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expire_at INTEGER
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cache_ttl ON cache(expire_at)
    `);
  }

  async get(key: string): Promise<string | null> {
    const stmt = this.db.prepare(
      `SELECT value FROM cache 
       WHERE key = ? AND (expire_at IS NULL OR expire_at > ?)
       LIMIT 1`
    );

    const result = stmt.get(key, Date.now()) as { value: string } | undefined;
    return result?.value ?? null;
  }

  async put(key: string, value: string, options?: CacheOptions): Promise<void> {
    let expireAt: number | null = null;
    const now = Date.now();

    if (options?.expirationTtl) {
      expireAt = now + options.expirationTtl * 1000;
    } else if (options?.expiration) {
      expireAt = options.expiration * 1000;
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, value, expire_at) 
      VALUES (?, ?, ?)
    `);

    stmt.run(key, value, expireAt);
  }

  async delete(key: string): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM cache WHERE key = ?`);
    stmt.run(key);
  }

  clearExpired(): void {
    const stmt = this.db.prepare(`DELETE FROM cache WHERE expire_at <= ?`);
    stmt.run(Date.now());
  }

  clearAll(): void {
    this.db.exec(`DELETE FROM cache`);
  }
}

export function createMemoryCache(): SQLiteCacheAdapter {
  const db = new DatabaseSync(":memory:");
  return new SQLiteCacheAdapter(db);
}

export function createFileCache(dbPath: string): SQLiteCacheAdapter {
  const db = new DatabaseSync(dbPath);
  return new SQLiteCacheAdapter(db);
}

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
