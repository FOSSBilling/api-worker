import { IPlatformBindings } from "../../interfaces";
import { createMemoryCache, createFileCache } from "./cache";
import { NodeEnvironmentAdapter } from "./environment";

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
