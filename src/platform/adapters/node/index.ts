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
    ? createFileCache(`${cacheDbPath}.kv`)
    : createMemoryCache();
  const authKv = cacheDbPath
    ? createFileCache(`${cacheDbPath}.auth`)
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
