import { IPlatformBindings } from "../../interfaces";
import { createMemoryCache, createFileCache } from "./cache";
import { NodeEnvironmentAdapter } from "./environment";

export function createNodeBindings(cacheDbPath?: string): IPlatformBindings {
  const cache = cacheDbPath
    ? createFileCache(cacheDbPath)
    : createMemoryCache();

  return {
    databases: {},
    caches: {
      CACHE_KV: cache,
      AUTH_KV: cache
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
