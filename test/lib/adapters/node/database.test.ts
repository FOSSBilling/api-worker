import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { existsSync, unlinkSync } from "node:fs";
import {
  SQLiteAdapter,
  createInMemoryDatabase,
  createFileDatabase,
  createDefaultAdapter
} from "../../../../src/lib/adapters/node/database";
import { IPreparedStatement } from "../../../../src/lib/interfaces";

describe("SQLiteAdapter", () => {
  let adapter: SQLiteAdapter;
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        value INTEGER
      )
    `);
    adapter = new SQLiteAdapter(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("prepare", () => {
    it("should prepare a statement", () => {
      const stmt = adapter.prepare("SELECT * FROM test_table");

      expect(stmt).toBeDefined();
      expect(typeof stmt.bind).toBe("function");
      expect(typeof stmt.all).toBe("function");
      expect(typeof stmt.first).toBe("function");
      expect(typeof stmt.run).toBe("function");
    });
  });

  describe("bind", () => {
    it("should bind parameters to statement", async () => {
      const stmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );

      stmt.bind("test", 123);

      const result = await stmt.run();
      expect(result.success).toBe(true);
    });

    it("should bind multiple parameters", async () => {
      const stmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );

      stmt.bind("name1", 1);
      await stmt.run();

      stmt.bind("name2", 2);
      await stmt.run();

      stmt.bind("name3", 3);
      const result = await stmt.run();

      expect(result.success).toBe(true);
    });

    it("should return statement after binding", async () => {
      const stmt = adapter.prepare("SELECT * FROM test_table WHERE id = ?");
      const boundStmt = stmt.bind(1);

      expect(boundStmt).toBe(stmt);
    });
  });

  describe("all", () => {
    beforeEach(() => {
      const stmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      stmt.bind("test1", 100).run();
      stmt.bind("test2", 200).run();
      stmt.bind("test3", 300).run();
    });

    it("should return all results", async () => {
      const stmt = adapter.prepare("SELECT * FROM test_table ORDER BY id");
      const result = await stmt.all();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results?.[0]).toMatchObject({ name: "test1", value: 100 });
      expect(result.results?.[1]).toMatchObject({ name: "test2", value: 200 });
      expect(result.results?.[2]).toMatchObject({ name: "test3", value: 300 });
    });

    it("should return empty array when no results", async () => {
      const stmt = adapter.prepare("SELECT * FROM test_table WHERE id = 999");
      const result = await stmt.all();

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });

  describe("first", () => {
    beforeEach(() => {
      const stmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      stmt.bind("first", 1).run();
      stmt.bind("second", 2).run();
    });

    it("should return first result", async () => {
      const stmt = adapter.prepare(
        "SELECT * FROM test_table ORDER BY id LIMIT 1"
      );
      const result = await stmt.first();

      expect(result).toMatchObject({ name: "first", value: 1 });
    });

    it("should return null when no results", async () => {
      const stmt = adapter.prepare("SELECT * FROM test_table WHERE id = 999");
      const result = await stmt.first();

      expect(result).toBeNull();
    });
  });

  describe("run", () => {
    it("should execute INSERT statement", async () => {
      const stmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      const result = await stmt.bind("test", 123).run();

      expect(result.success).toBe(true);
      expect(result.meta?.changes).toBe(1);
      expect(result.meta?.last_row_id).toBeGreaterThanOrEqual(1);
    });

    it("should execute UPDATE statement", async () => {
      const stmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      await stmt.bind("original", 1).run();

      const updateStmt = adapter.prepare(
        "UPDATE test_table SET value = ? WHERE name = ?"
      );
      const result = await updateStmt.bind(999, "original").run();

      expect(result.success).toBe(true);
      expect(result.meta?.changes).toBe(1);
    });

    it("should execute DELETE statement", async () => {
      const insertStmt = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      await insertStmt.bind("to-delete", 1).run();

      const deleteStmt = adapter.prepare(
        "DELETE FROM test_table WHERE name = ?"
      );
      const result = await deleteStmt.bind("to-delete").run();

      expect(result.success).toBe(true);
      expect(result.meta?.changes).toBe(1);
    });
  });

  describe("batch", () => {
    it("should execute multiple statements in transaction", async () => {
      const stmt1 = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      const stmt2 = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );
      const stmt3 = adapter.prepare(
        "INSERT INTO test_table (name, value) VALUES (?, ?)"
      );

      const results: unknown[] = await adapter.batch([
        stmt1.bind("batch1", 1),
        stmt2.bind("batch2", 2),
        stmt3.bind("batch3", 3)
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty("success");
      expect(results[1]).toHaveProperty("success");
      expect(results[2]).toHaveProperty("success");
    });

    it("should handle empty batch array", async () => {
      const results = await adapter.batch([]);

      expect(results).toEqual([]);
    });

    it("should throw error for invalid statement type", async () => {
      const validStmt = adapter.prepare(
        "INSERT INTO test_table (name) VALUES (?)"
      );
      const invalidStmt = {
        bind: vi.fn(),
        all: vi.fn(),
        first: vi.fn(),
        run: vi.fn()
      } as IPreparedStatement;

      await expect(
        adapter.batch([validStmt.bind("test"), invalidStmt])
      ).rejects.toThrow("Invalid statement type for SQLite batch");
    });
  });
});

describe("Factory Functions", () => {
  const testDbPath = "/tmp/test-sqlite.db";

  afterEach(() => {
    try {
      if (existsSync(testDbPath)) {
        unlinkSync(testDbPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("createInMemoryDatabase", () => {
    it("should create an in-memory database", () => {
      const db = createInMemoryDatabase();

      expect(db).toBeInstanceOf(DatabaseSync);
    });

    it("should allow operations on in-memory database", () => {
      const db = createInMemoryDatabase();
      db.exec("CREATE TABLE test (id INTEGER)");
      db.exec("INSERT INTO test VALUES (1)");

      const stmt = db.prepare("SELECT * FROM test");
      const result = stmt.all();

      expect(result).toHaveLength(1);
    });
  });

  describe("createFileDatabase", () => {
    it("should create a file-based database", () => {
      const db = createFileDatabase(testDbPath);

      expect(db).toBeInstanceOf(DatabaseSync);
      expect(db).toBeDefined();
      db.close();
    });

    it("should persist data to file", () => {
      const db1 = createFileDatabase(testDbPath);
      db1.exec("CREATE TABLE test (id INTEGER)");
      db1.exec("INSERT INTO test VALUES (1)");
      db1.close();

      const db2 = createFileDatabase(testDbPath);
      const stmt = db2.prepare("SELECT * FROM test");
      const result = stmt.all();

      expect(result).toHaveLength(1);
      db2.close();
    });
  });

  describe("createDefaultAdapter", () => {
    it("should create adapter with in-memory database", () => {
      const adapter = createDefaultAdapter();

      expect(adapter).toBeInstanceOf(SQLiteAdapter);
    });

    it("should allow operations on created adapter", async () => {
      const adapter = createDefaultAdapter();
      adapter.prepare("CREATE TABLE test (id INTEGER)").run();

      const stmt = adapter.prepare("SELECT * FROM test");
      const result = await stmt.all();

      expect(result.success).toBe(true);
    });
  });
});
