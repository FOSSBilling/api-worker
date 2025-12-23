import { IDatabase, IPreparedStatement } from "../../interfaces";
import { DatabaseSync } from "node:sqlite";

/**
 * SQLite database adapter for Node.js environments.
 *
 * Provides a database interface using Node.js built-in SQLite module.
 * Requires Node.js 22.5+ for node:sqlite support.
 *
 * @example
 * ```ts
 * import { DatabaseSync } from "node:sqlite";
 * import { SQLiteAdapter } from "./database";
 *
 * const db = new DatabaseSync("mydb.sqlite");
 * const adapter = new SQLiteAdapter(db);
 * const stmt = adapter.prepare("SELECT * FROM users WHERE id = ?");
 * const result = await stmt.bind(1).first();
 * ```
 */
export class SQLiteAdapter implements IDatabase {
  constructor(private db: DatabaseSync) {}

  prepare(query: string): IPreparedStatement {
    return new SQLiteStatement(this.db, query);
  }

  async batch(statements: IPreparedStatement[]): Promise<unknown[]> {
    this.db.exec("BEGIN");
    const results = [];

    try {
      for (const stmt of statements) {
        if (stmt instanceof SQLiteStatement) {
          const result = await stmt.run();

          if (!result.success && result.error) {
            throw new Error(result.error);
          }

          results.push(result);
        } else {
          throw new Error("Invalid statement type for SQLite batch");
        }
      }

      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

class SQLiteStatement implements IPreparedStatement {
  private params: unknown[] = [];
  private statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(
    private db: DatabaseSync,
    private query: string
  ) {
    this.statement = this.db.prepare(this.query);
  }

  bind(...params: unknown[]): IPreparedStatement {
    this.params = params;
    return this;
  }

  async all<T = unknown>(): Promise<{ results?: T[]; success: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = this.statement.all(...(this.params as any[]));

    return {
      results: results as T[],
      success: true
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = this.statement.get(...(this.params as any[]));
      return (result as T) ?? null;
    } catch (error) {
      console.error("SQLiteStatement.first: failed to execute query", error);
      return null;
    }
  }

  async run(): Promise<{
    success: boolean;
    error?: string;
    meta?: {
      changes?: number;
      last_row_id?: number;
      [key: string]: unknown;
    };
  }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = this.statement.run(...(this.params as any[]));

      return {
        success: true,
        meta: {
          changes: Number(result.changes),
          last_row_id: Number(result.lastInsertRowid)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export function createInMemoryDatabase(): DatabaseSync {
  return new DatabaseSync(":memory:");
}

export function createFileDatabase(filename: string): DatabaseSync {
  try {
    return new DatabaseSync(filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create SQLite database at "${filename}": ${message}`,
      {
        cause: error instanceof Error ? error : undefined
      }
    );
  }
}

export function createDefaultAdapter(): SQLiteAdapter {
  const db = createInMemoryDatabase();
  return new SQLiteAdapter(db);
}
