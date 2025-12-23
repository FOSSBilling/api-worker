import { Context, MiddlewareHandler } from "hono";
import { IPlatformBindings } from "./interfaces";
import { createPlatformContext, PlatformContext } from "./context";

declare module "hono" {
  interface ContextVariableMap {
    platform: PlatformContext;
  }
}

export function platformMiddleware(
  bindings: IPlatformBindings
): MiddlewareHandler {
  return async (c, next) => {
    c.set("platform", createPlatformContext(c, bindings));
    await next();
  };
}

export function getPlatform(c: Context): PlatformContext {
  const platform = c.get("platform");
  if (!platform) {
    throw new Error("Platform context not found");
  }
  return platform;
}
