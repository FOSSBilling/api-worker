import { DatabaseSync } from "node:sqlite";
import { ICache, CacheOptions } from "../../interfaces";

/**
 * SQLite-based cache adapter for Node.js environments.
 *
 * Provides persistent or in-memory caching with TTL support using Node.js
 * built-in SQLite module. Requires Node.js 22.5+ for node:sqlite support.
 *
 * Cache entries support two expiration modes:
 * - expirationTtl: seconds from now
 * - expiration: Unix timestamp (seconds since epoch)
 *
 * Permanent entries (no expiration) are stored with NULL expire_at.
 *
 * @example
 * ```ts
 * import { SQLiteCacheAdapter, createFileCache } from "./cache";
 *
 * const cache = createFileCache("./cache.db");
 * await cache.put("key", "value", { expirationTtl: 3600 });
 * const value = await cache.get("key"); // "value"
 * ```
 */
export class SQLiteCacheAdapter implements ICache {
  private db: DatabaseSync;
  private stmtGet: ReturnType<DatabaseSync["prepare"]>;
  private stmtPut: ReturnType<DatabaseSync["prepare"]>;
  private stmtDelete: ReturnType<DatabaseSync["prepare"]>;
  private stmtClearExpired: ReturnType<DatabaseSync["prepare"]>;

  /**
   * Creates a new SQLite cache adapter.
   *
   * @param database - A DatabaseSync instance from node:sqlite. Can be
   *   in-memory (":memory:") or file-based.
   */
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

  /**
   * Retrieves a value from the cache.
   *
   * Returns null if the key doesn't exist or has expired. Expired entries
   * are not automatically removed on get - use clearExpired() for cleanup.
   *
   * @param key - The cache key to retrieve
   * @returns The cached value or null if not found/expired
   * @throws Error if the database operation fails
   */
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

  /**
   * Stores a value in the cache with optional expiration.
   *
   * Overwrites existing values. Supports two expiration modes:
   * - expirationTtl: seconds from current time
   * - expiration: Unix timestamp in seconds
   *
   * If no expiration options provided, entry persists until manually deleted.
   *
   * @param key - The cache key
   * @param value - The value to store
   * @param options - Optional expiration settings
   * @throws Error if the database operation fails
   */
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

  /**
   * Removes a value from the cache.
   *
   * Silently succeeds if key doesn't exist.
   *
   * @param key - The cache key to delete
   * @throws Error if the database operation fails
   */
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

  /**
   * Removes all expired entries from the cache.
   *
   * Affects only entries with expire_at timestamp in the past.
   * Permanent entries (NULL expire_at) are preserved.
   *
   * @throws Error if the database operation fails
   */
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

  /**
   * Removes all entries from the cache.
   *
   * Deletes both permanent and expired entries. Performs VACUUM
   * to reclaim disk space for file-based databases.
   *
   * @throws Error if the database operation fails
   */
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

/**
 * Creates an in-memory SQLite cache adapter.
 *
 * Cache contents are lost when the process exits. Suitable for testing
 * or temporary caching where persistence isn't required.
 *
 * @returns A new SQLiteCacheAdapter using an in-memory database
 * @throws Error if database creation fails
 *
 * @example
 * ```ts
 * const cache = createMemoryCache();
 * await cache.put("temp", "data");
 * ```
 */
export function createMemoryCache(): SQLiteCacheAdapter {
  const db = new DatabaseSync(":memory:");
  return new SQLiteCacheAdapter(db);
}

/**
 * Creates a file-based SQLite cache adapter.
 *
 * Cache contents persist across process restarts. Creates the database
 * file and cache table if they don't exist. The file is created in the
 * directory specified by dbPath - ensure the directory exists and is writable.
 *
 * @param dbPath - Path to the SQLite database file
 * @returns A new SQLiteCacheAdapter using a file-based database
 * @throws Error if the path is invalid or database creation fails
 *
 * @example
 * ```ts
 * const cache = createFileCache("./cache/myapp.db");
 * await cache.put("key", "value", { expirationTtl: 86400 });
 * ```
 */
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
