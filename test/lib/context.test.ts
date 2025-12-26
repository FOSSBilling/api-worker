import { describe, it, expect } from "vitest";
import { Context } from "hono";
import { createPlatformContext } from "../../src/lib/context";
import {
  IPlatformBindings,
  IPreparedStatement
} from "../../src/lib/interfaces";

describe("createPlatformContext", () => {
  const mockBindings: IPlatformBindings = {
    databases: {
      testDb: {
        prepare: () => {
          const mockStmt: IPreparedStatement = {
            bind: () => mockStmt,
            all: async () => ({ results: [], success: true }),
            first: async () => null,
            run: async () => ({ success: true })
          };
          return mockStmt;
        }
      }
    },
    caches: {
      testCache: {
        get: async () => null,
        put: async () => {},
        delete: async () => {}
      }
    },
    environment: {
      get: (key) => (key === "TEST_VAR" ? "test-value" : undefined),
      has: (key) => key === "TEST_VAR"
    }
  };

  const mockHonoContext = {
    get: () => ({}),
    set: () => {},
    req: {},
    res: {}
  } as unknown as Context;

  it("should create a platform context with all required methods", () => {
    const context = createPlatformContext(mockHonoContext, mockBindings);

    expect(context).toHaveProperty("getDatabase");
    expect(context).toHaveProperty("getCache");
    expect(context).toHaveProperty("getEnv");
    expect(context).toHaveProperty("raw");
  });

  describe("getDatabase", () => {
    it("should return the requested database binding", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);
      const db = context.getDatabase("testDb");

      expect(db).toBe(mockBindings.databases.testDb);
    });

    it("should throw when database binding not found", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);

      expect(() => context.getDatabase("nonexistent")).toThrow(
        "Database binding 'nonexistent' not found"
      );
    });
  });

  describe("getCache", () => {
    it("should return the requested cache binding", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);
      const cache = context.getCache("testCache");

      expect(cache).toBe(mockBindings.caches.testCache);
    });

    it("should throw when cache binding not found", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);

      expect(() => context.getCache("nonexistent")).toThrow(
        "Cache binding 'nonexistent' not found"
      );
    });
  });

  describe("getEnv", () => {
    it("should return environment variable value when it exists", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);
      const value = context.getEnv("TEST_VAR");

      expect(value).toBe("test-value");
    });

    it("should return undefined when environment variable does not exist", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);
      const value = context.getEnv("NONEXISTENT");

      expect(value).toBeUndefined();
    });
  });

  describe("raw property", () => {
    it("should return the original Hono context", () => {
      const context = createPlatformContext(mockHonoContext, mockBindings);

      expect(context.raw).toBe(mockHonoContext);
    });
  });
});
