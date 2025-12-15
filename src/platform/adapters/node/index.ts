// Reference implementation for Node.js
// Install dependencies: npm install pg ioredis @types/pg @types/ioredis

import { IPlatformBindings } from "../../interfaces";
import { InMemoryCacheAdapter } from "./cache";
import { NodeEnvironmentAdapter } from "./environment";

export function createNodeBindings(): IPlatformBindings {
  return {
    databases: {},
    caches: {
      CACHE_KV: new InMemoryCacheAdapter(),
      AUTH_KV: new InMemoryCacheAdapter()
    },
    environment: new NodeEnvironmentAdapter()
  };
}

export { InMemoryCacheAdapter, RedisAdapter } from "./cache";
export { NodeEnvironmentAdapter } from "./environment";
export { PostgreSQLAdapter } from "./database";
