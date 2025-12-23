import { Context } from "hono";
import { IDatabase, ICache, IPlatformBindings } from "./interfaces";

export interface PlatformContext {
  getDatabase(name: string): IDatabase;
  getCache(name: string): ICache;
  getEnv(key: string): string | undefined;
  readonly raw: Context;
}

export function createPlatformContext(
  c: Context,
  bindings: IPlatformBindings
): PlatformContext {
  return {
    getDatabase(name: string): IDatabase {
      const db = bindings.databases[name];
      if (!db) {
        throw new Error(`Database binding '${name}' not found`);
      }
      return db;
    },

    getCache(name: string): ICache {
      const cache = bindings.caches[name];
      if (!cache) {
        throw new Error(`Cache binding '${name}' not found`);
      }
      return cache;
    },

    getEnv(key: string): string | undefined {
      return bindings.environment.get(key);
    },

    get raw(): Context {
      return c;
    }
  };
}
