import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CloudflareKVAdapter } from "../../../../src/lib/adapters/cloudflare/cache";

describe("CloudflareKVAdapter", () => {
  let mockKV: KVNamespace;
  let adapter: CloudflareKVAdapter;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as unknown as KVNamespace;

    adapter = new CloudflareKVAdapter(mockKV);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("get", () => {
    it("should get value from KV store", async () => {
      mockKV.get = vi.fn().mockResolvedValue("test-value");

      const result = await adapter.get("test-key");

      expect(mockKV.get).toHaveBeenCalledWith("test-key");
      expect(result).toBe("test-value");
    });

    it("should return null for non-existent keys", async () => {
      mockKV.get = vi.fn().mockResolvedValue(null);

      const result = await adapter.get("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("put", () => {
    it("should put value to KV store", async () => {
      mockKV.put = vi.fn().mockResolvedValue(undefined);

      await adapter.put("test-key", "test-value");

      expect(mockKV.put).toHaveBeenCalledWith(
        "test-key",
        "test-value",
        undefined
      );
    });

    it("should put value with expirationTtl option", async () => {
      mockKV.put = vi.fn().mockResolvedValue(undefined);

      await adapter.put("test-key", "test-value", { expirationTtl: 3600 });

      expect(mockKV.put).toHaveBeenCalledWith("test-key", "test-value", {
        expirationTtl: 3600
      });
    });

    it("should put value with expiration option", async () => {
      mockKV.put = vi.fn().mockResolvedValue(undefined);

      const expirationTime = Math.floor(Date.now() / 1000) + 3600;
      await adapter.put("test-key", "test-value", {
        expiration: expirationTime
      });

      expect(mockKV.put).toHaveBeenCalledWith("test-key", "test-value", {
        expiration: expirationTime
      });
    });

    it("should put value with both expiration options", async () => {
      mockKV.put = vi.fn().mockResolvedValue(undefined);

      await adapter.put("test-key", "test-value", {
        expirationTtl: 3600,
        expiration: 1234567890
      });

      expect(mockKV.put).toHaveBeenCalledWith("test-key", "test-value", {
        expirationTtl: 3600,
        expiration: 1234567890
      });
    });
  });

  describe("delete", () => {
    it("should delete key from KV store", async () => {
      mockKV.delete = vi.fn().mockResolvedValue(undefined);

      await adapter.delete("test-key");

      expect(mockKV.delete).toHaveBeenCalledWith("test-key");
    });
  });

  describe("Multiple Operations", () => {
    it("should handle sequence of get and put operations", async () => {
      mockKV.get = vi.fn().mockResolvedValue(null);
      mockKV.put = vi.fn().mockResolvedValue(undefined);

      await adapter.put("key1", "value1");
      await adapter.put("key2", "value2");

      mockKV.get = vi.fn().mockResolvedValue("value1");
      const result1 = await adapter.get("key1");

      mockKV.get = vi.fn().mockResolvedValue("value2");
      const result2 = await adapter.get("key2");

      expect(result1).toBe("value1");
      expect(result2).toBe("value2");
    });

    it("should handle delete after put", async () => {
      mockKV.put = vi.fn().mockResolvedValue(undefined);
      mockKV.get = vi.fn().mockResolvedValue("test-value");
      mockKV.delete = vi.fn().mockResolvedValue(undefined);

      await adapter.put("test-key", "test-value");
      await adapter.delete("test-key");

      mockKV.get = vi.fn().mockResolvedValue(null);
      const result = await adapter.get("test-key");

      expect(result).toBeNull();
    });
  });
});
