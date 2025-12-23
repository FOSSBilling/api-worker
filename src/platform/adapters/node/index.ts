import { IPlatformBindings } from "../../interfaces";
import { createMemoryCache, createFileCache } from "./cache";
import { NodeEnvironmentAdapter } from "./environment";

/**
 * Creates platform bindings for the Node.js environment.
 *
 * @param cacheDbPath Optional base file path (without extension) for
 *   persistent cache databases. When provided, two file-backed caches
 *   are created using `${cacheDbPath}.kv` for general caching and
 *   `${cacheDbPath}.auth` for auth-related caching. When omitted or
 *   `undefined`, in-memory caches are used instead.
 * @returns Platform bindings configured with either file-backed or
 *   in-memory cache adapters for CACHE_KV and AUTH_KV.
 */
export function createNodeBindings(cacheDbPath?: string): IPlatformBindings {
  const cacheKv = cacheDbPath
    ? createFileCache(`${normalizePath(cacheDbPath)}.kv`)
    : createMemoryCache();
  const authKv = cacheDbPath
    ? createFileCache(`${normalizePath(cacheDbPath)}.auth`)
    : createMemoryCache();

  return {
    databases: {},
    caches: {
      CACHE_KV: cacheKv,
      AUTH_KV: authKv
    },
    environment: new NodeEnvironmentAdapter()
  };
}

/**
 * Normalizes a file path by removing trailing dots, slashes, and common
 * extensions to prevent malformed paths when appending suffixes.
 */
function normalizePath(path: string): string {
  // Remove trailing dots and slashes
  let normalized = path.replace(/[./]+$/, "");

  // Remove common extensions if present
  normalized = normalized.replace(/\.(?:sqlite|db|sqlite3)$/i, "");

  return normalized;
}

export {
  SQLiteCacheAdapter,
  createMemoryCache,
  createFileCache,
  InMemoryCacheAdapter,
  RedisAdapter
} from "./cache";
export { NodeEnvironmentAdapter } from "./environment";
export {
  SQLiteAdapter,
  createInMemoryDatabase,
  createFileDatabase,
  createDefaultAdapter
} from "./database";
