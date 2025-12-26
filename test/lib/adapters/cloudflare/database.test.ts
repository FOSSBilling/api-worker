import { describe, it, expect, beforeEach, vi } from "vitest";
import { CloudflareD1Adapter } from "../../../../src/lib/adapters/cloudflare/database";
import { IPreparedStatement } from "../../../../src/lib/interfaces";

describe("CloudflareD1Adapter", () => {
  let mockD1: D1Database;
  let mockStatement: D1PreparedStatement;
  let adapter: CloudflareD1Adapter;

  beforeEach(() => {
    mockStatement = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} })
    } as unknown as D1PreparedStatement;

    mockD1 = {
      prepare: vi.fn().mockReturnValue(mockStatement),
      batch: vi.fn().mockResolvedValue([])
    } as unknown as D1Database;

    adapter = new CloudflareD1Adapter(mockD1);
  });

  describe("prepare", () => {
    it("should prepare a statement", () => {
      const result = adapter.prepare("SELECT * FROM table");

      expect(mockD1.prepare).toHaveBeenCalledWith("SELECT * FROM table");
      expect(result).toBeDefined();
      expect(result.all).toBeDefined();
      expect(result.first).toBeDefined();
      expect(result.run).toBeDefined();
    });
  });

  describe("bind", () => {
    it("should bind parameters to statement", async () => {
      const stmt = adapter.prepare("SELECT * FROM table WHERE id = ?");

      stmt.bind(1, 2, 3);

      expect(mockStatement.bind).toHaveBeenCalledWith(1, 2, 3);
    });

    it("should return statement after binding", async () => {
      const stmt = adapter.prepare("SELECT * FROM table");
      const boundStmt = stmt.bind("param1");

      expect(boundStmt).toBe(stmt);
    });
  });

  describe("all", () => {
    it("should return all results", async () => {
      mockStatement.all = vi.fn().mockResolvedValue({
        results: [{ id: 1 }, { id: 2 }],
        success: true
      });

      const stmt = adapter.prepare("SELECT * FROM table");
      const result = await stmt.all();

      expect(result.results).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.success).toBe(true);
    });

    it("should return empty results array when no results", async () => {
      mockStatement.all = vi.fn().mockResolvedValue({
        results: undefined,
        success: true
      });

      const stmt = adapter.prepare("SELECT * FROM table");
      const result = await stmt.all();

      expect(result.results).toBeUndefined();
    });
  });

  describe("first", () => {
    it("should return first result", async () => {
      const mockData = { id: 1, name: "test" };
      mockStatement.first = vi.fn().mockResolvedValue(mockData);

      const stmt = adapter.prepare("SELECT * FROM table LIMIT 1");
      const result = await stmt.first();

      expect(result).toEqual(mockData);
    });

    it("should return null when no results", async () => {
      mockStatement.first = vi.fn().mockResolvedValue(null);

      const stmt = adapter.prepare("SELECT * FROM table LIMIT 1");
      const result = await stmt.first();

      expect(result).toBeNull();
    });
  });

  describe("run", () => {
    it("should execute statement and return result", async () => {
      mockStatement.run = vi.fn().mockResolvedValue({
        success: true,
        meta: { changes: 1, last_row_id: 123 }
      });

      const stmt = adapter.prepare("INSERT INTO table (name) VALUES (?)");
      const result = await stmt.run();

      expect(result.success).toBe(true);
      expect(result.meta?.changes).toBe(1);
      expect(result.meta?.last_row_id).toBe(123);
    });

    it("should return success false on failure", async () => {
      const mockError = new Error("Database error");
      mockStatement.run = vi.fn().mockResolvedValue({
        success: false,
        error: mockError
      });

      const stmt = adapter.prepare("INSERT INTO table (name) VALUES (?)");
      const result = await stmt.run();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return success false when error is string", async () => {
      mockStatement.run = vi.fn().mockResolvedValue({
        success: false,
        error: "SQL error"
      });

      const stmt = adapter.prepare("INSERT INTO table (name) VALUES (?)");
      const result = await stmt.run();

      expect(result.success).toBe(false);
      expect(result.error).toBe("SQL error");
    });
  });

  describe("batch", () => {
    it("should execute multiple statements", async () => {
      const stmt1 = adapter.prepare("INSERT INTO table (name) VALUES (?)");
      const stmt2 = adapter.prepare("UPDATE table SET name = ? WHERE id = ?");

      const results: unknown[] = [{ success: true }, { success: true }];
      mockD1.batch = vi.fn().mockResolvedValue(results);

      const result = await adapter.batch([stmt1, stmt2]);

      expect(mockD1.batch).toHaveBeenCalledWith([
        expect.objectContaining({}),
        expect.objectContaining({})
      ]);
      expect(result).toEqual(results);
    });

    it("should throw error when statement is not CloudflareD1Statement", async () => {
      const stmt1 = adapter.prepare("SELECT * FROM table");
      const invalidStmt = {
        bind: vi.fn(),
        all: vi.fn(),
        first: vi.fn(),
        run: vi.fn()
      } as IPreparedStatement;

      await expect(adapter.batch([stmt1, invalidStmt])).rejects.toThrow(
        "Invalid statement type for D1 batch"
      );
    });

    it("should handle empty batch array", async () => {
      const results: unknown[] = [];
      mockD1.batch = vi.fn().mockResolvedValue(results);

      const result = await adapter.batch([]);

      expect(mockD1.batch).toHaveBeenCalledWith([]);
      expect(result).toEqual([]);
    });
  });
});
