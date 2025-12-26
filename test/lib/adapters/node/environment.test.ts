import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NodeEnvironmentAdapter } from "../../../../src/lib/adapters/node/environment";

describe("NodeEnvironmentAdapter", () => {
  let adapter: NodeEnvironmentAdapter;

  beforeEach(() => {
    adapter = new NodeEnvironmentAdapter();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("get", () => {
    it("should return environment variable when it exists", () => {
      vi.stubEnv("TEST_VAR", "test-value");

      const result = adapter.get("TEST_VAR");

      expect(result).toBe("test-value");
    });

    it("should return undefined when environment variable does not exist", () => {
      vi.stubEnv("NONEXISTENT_VAR", undefined);

      const result = adapter.get("NONEXISTENT_VAR");

      expect(result).toBeUndefined();
    });

    it("should return empty string for empty environment variable", () => {
      vi.stubEnv("EMPTY_VAR", "");

      const result = adapter.get("EMPTY_VAR");

      expect(result).toBe("");
    });

    it("should return string value when environment variable is set", () => {
      vi.stubEnv("ANOTHER_VAR", "another-value");

      const result = adapter.get("ANOTHER_VAR");

      expect(result).toBe("another-value");
    });
  });

  describe("has", () => {
    it("should return true when environment variable exists", () => {
      vi.stubEnv("EXISTING_VAR", "some-value");

      const result = adapter.has("EXISTING_VAR");

      expect(result).toBe(true);
    });

    it("should return false when environment variable does not exist", () => {
      const result = adapter.has("NONEXISTENT_VAR");

      expect(result).toBe(false);
    });

    it("should return true for empty string environment variable", () => {
      vi.stubEnv("EMPTY_VAR", "");

      const result = adapter.has("EMPTY_VAR");

      expect(result).toBe(true);
    });

    it("should return false for undefined environment variable", () => {
      vi.stubEnv("UNDEFINED_VAR", undefined);

      const result = adapter.has("UNDEFINED_VAR");

      expect(result).toBe(false);
    });
  });

  describe("Multiple Environment Variables", () => {
    it("should access multiple environment variables", () => {
      vi.stubEnv("VAR1", "value1");
      vi.stubEnv("VAR2", "value2");
      vi.stubEnv("VAR3", "value3");

      expect(adapter.get("VAR1")).toBe("value1");
      expect(adapter.get("VAR2")).toBe("value2");
      expect(adapter.get("VAR3")).toBe("value3");
    });

    it("should check existence of multiple environment variables", () => {
      vi.stubEnv("VAR_A", "value-a");
      vi.stubEnv("VAR_B", "value-b");

      expect(adapter.has("VAR_A")).toBe(true);
      expect(adapter.has("VAR_B")).toBe(true);
      expect(adapter.has("VAR_C")).toBe(false);
    });
  });
});
