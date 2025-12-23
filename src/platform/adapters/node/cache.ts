import { DatabaseSync } from "node:sqlite";
import { ICache, CacheOptions } from "../../interfaces";

export class SQLiteCacheAdapter implements ICache {
  private db: DatabaseSync;
  private stmtGet: ReturnType<DatabaseSync["prepare"]>;
  private stmtPut: ReturnType<DatabaseSync["prepare"]>;
  private stmtDelete: ReturnType<DatabaseSync["prepare"]>;
  private stmtClearExpired: ReturnType<DatabaseSync["prepare"]>;

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
      CREATE INDEX IF NOT EXISTS idx_cache_expire_at ON cache(expire_at)
    `);

    this.stmtGet = this.db.prepare(
      `SELECT value FROM cache 
       WHERE key = ? AND (expire_at IS NULL OR expire_at > ?)
       LIMIT 1`
    );
    this.stmtPut = this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, value, expire_at) 
      VALUES (?, ?, ?)
    `);
    this.stmtDelete = this.db.prepare(`DELETE FROM cache WHERE key = ?`);
    this.stmtClearExpired = this.db.prepare(
      `DELETE FROM cache WHERE expire_at IS NOT NULL AND expire_at <= ?`
    );
  }

  async get(key: string): Promise<string | null> {
    try {
      const result = this.stmtGet.get(key, Date.now()) as
        | { value: string }
        | undefined;
      return result?.value ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to get cache entry for key "${key}": ${message}`,
        error instanceof Error ? { cause: error } : undefined
      );
    }
  }

  async put(key: string, value: string, options?: CacheOptions): Promise<void> {
    try {
      let expireAt: number | null = null;
      const now = Date.now();

      if (options?.expirationTtl) {
        expireAt = now + options.expirationTtl * 1000;
      } else if (options?.expiration) {
        expireAt = options.expiration * 1000;
      }

      this.stmtPut.run(key, value, expireAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to put cache entry for key "${key}": ${message}`,
        error instanceof Error ? { cause: error } : undefined
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.stmtDelete.run(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to delete cache entry for key "${key}": ${message}`,
        error instanceof Error ? { cause: error } : undefined
      );
    }
  }

  clearExpired(): void {
    try {
      this.stmtClearExpired.run(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to clear expired cache entries: ${message}`,
        error instanceof Error ? { cause: error } : undefined
      );
    }
  }

  clearAll(): void {
    try {
      this.db.exec(`DELETE FROM cache`);
      this.db.exec(`VACUUM`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to clear cache: ${message}`,
        error instanceof Error ? { cause: error } : undefined
      );
    }
  }
}

export function createMemoryCache(): SQLiteCacheAdapter {
  const db = new DatabaseSync(":memory:");
  return new SQLiteCacheAdapter(db);
}

export function createFileCache(dbPath: string): SQLiteCacheAdapter {
  if (typeof dbPath !== "string" || dbPath.trim() === "") {
    throw new Error("Invalid database path provided to createFileCache");
  }

  try {
    const db = new DatabaseSync(dbPath);
    return new SQLiteCacheAdapter(db);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create file cache at path "${dbPath}": ${message}`,
      error instanceof Error ? { cause: error } : undefined
    );
  }
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
