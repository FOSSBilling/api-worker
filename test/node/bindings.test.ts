import { describe, it, expect, afterEach } from "vitest";
import { createNodeBindings } from "../../src/platform/adapters/node/index";
import { existsSync, unlinkSync } from "node:fs";

describe("createNodeBindings - path normalization", () => {
  const testPaths = [
    "/tmp/test-binding-normal",
    "/tmp/test-binding.db",
    "/tmp/test-binding.sqlite",
    "/tmp/test-binding.sqlite3",
    "/tmp/test-binding.",
    "/tmp/test-binding..",
    "/tmp/test-binding/",
    "./test-binding"
  ];

  afterEach(() => {
    // Clean up test files
    testPaths.forEach((basePath) => {
      try {
        if (existsSync(`${basePath}.kv`)) unlinkSync(`${basePath}.kv`);
        if (existsSync(`${basePath}.auth`)) unlinkSync(`${basePath}.auth`);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  it("should handle paths without extensions", () => {
    const bindings = createNodeBindings("/tmp/test-binding-normal");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should handle paths with .db extension", () => {
    const bindings = createNodeBindings("/tmp/test-binding.db");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should handle paths with .sqlite extension", () => {
    const bindings = createNodeBindings("/tmp/test-binding.sqlite");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should handle paths with .sqlite3 extension", () => {
    const bindings = createNodeBindings("/tmp/test-binding.sqlite3");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should handle paths ending with dot", () => {
    const bindings = createNodeBindings("/tmp/test-binding.");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should handle paths ending with double dots", () => {
    const bindings = createNodeBindings("/tmp/test-binding..");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should handle paths ending with slash", () => {
    const bindings = createNodeBindings("/tmp/test-binding/");
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should create in-memory caches when path is undefined", () => {
    const bindings = createNodeBindings(undefined);
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });

  it("should create in-memory caches when path is not provided", () => {
    const bindings = createNodeBindings();
    expect(bindings.caches.CACHE_KV).toBeDefined();
    expect(bindings.caches.AUTH_KV).toBeDefined();
  });
});
