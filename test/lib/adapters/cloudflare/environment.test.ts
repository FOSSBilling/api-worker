import { describe, it, expect, beforeEach } from "vitest";
import { CloudflareEnvironmentAdapter } from "../../../../src/lib/adapters/cloudflare/environment";

describe("CloudflareEnvironmentAdapter", () => {
  let adapter: CloudflareEnvironmentAdapter;

  beforeEach(() => {
    const env = {
      STRING_VAR: "test-value",
      NUMBER_VAR: 123,
      BOOLEAN_VAR: true,
      OBJECT_VAR: { key: "value" },
      UNDEFINED_VAR: undefined,
      NULL_VAR: null
    };

    adapter = new CloudflareEnvironmentAdapter(env as Record<string, unknown>);
  });

  describe("get", () => {
    it("should return value when it exists and is a string", () => {
      const result = adapter.get("STRING_VAR");

      expect(result).toBe("test-value");
    });

    it("should return undefined when value exists but is not a string", () => {
      const result1 = adapter.get("NUMBER_VAR");
      const result2 = adapter.get("BOOLEAN_VAR");
      const result3 = adapter.get("OBJECT_VAR");

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(result3).toBeUndefined();
    });

    it("should return undefined when value is undefined", () => {
      const result = adapter.get("UNDEFINED_VAR");

      expect(result).toBeUndefined();
    });

    it("should return undefined when value is null", () => {
      const result = adapter.get("NULL_VAR");

      expect(result).toBeUndefined();
    });

    it("should return undefined when key does not exist", () => {
      const result = adapter.get("NONEXISTENT_VAR");

      expect(result).toBeUndefined();
    });

    it("should handle empty string values", () => {
      const env = { EMPTY_VAR: "" };
      const emptyAdapter = new CloudflareEnvironmentAdapter(env);

      const result = emptyAdapter.get("EMPTY_VAR");

      expect(result).toBe("");
    });
  });

  describe("has", () => {
    it("should return true when key exists and is a string", () => {
      const result = adapter.has("STRING_VAR");

      expect(result).toBe(true);
    });

    it("should return false when key exists but is not a string", () => {
      const result1 = adapter.has("NUMBER_VAR");
      const result2 = adapter.has("BOOLEAN_VAR");
      const result3 = adapter.has("OBJECT_VAR");

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });

    it("should return false when key does not exist", () => {
      const result = adapter.has("NONEXISTENT_VAR");

      expect(result).toBe(false);
    });

    it("should return true for empty string values", () => {
      const env = { EMPTY_VAR: "" };
      const emptyAdapter = new CloudflareEnvironmentAdapter(env);

      const result = emptyAdapter.has("EMPTY_VAR");

      expect(result).toBe(true);
    });
  });
});
