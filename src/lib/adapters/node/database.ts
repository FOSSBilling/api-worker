import { IDatabase, IPreparedStatement } from "../../interfaces";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export class SQLiteAdapter implements IDatabase {
  constructor(private db: DatabaseSync) {}

  prepare(query: string): IPreparedStatement {
    return new SQLiteStatement(this.db, query);
  }

  async batch(statements: IPreparedStatement[]): Promise<unknown[]> {
    this.db.exec("BEGIN IMMEDIATE");
    const results = [];

    try {
      for (const stmt of statements) {
        if (stmt instanceof SQLiteStatement) {
          const result = await stmt.run();

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

type SQLiteParams = SQLInputValue[];

class SQLiteStatement implements IPreparedStatement {
  private params: SQLiteParams = [];
  private statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(db: DatabaseSync, query: string) {
    this.statement = db.prepare(query);
  }

  bind(...params: unknown[]): IPreparedStatement {
    this.params = params as SQLiteParams;
    return this;
  }

  async all<T = unknown>(): Promise<{ results?: T[]; success: boolean }> {
    const results = this.statement.all(...this.params);

    return {
      results: results as T[],
      success: true
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = this.statement.get(...this.params);
    return (result as T) ?? null;
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
    const result = this.statement.run(...this.params);

    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid)
      }
    };
  }
}

export function createInMemoryDatabase(): DatabaseSync {
  return new DatabaseSync(":memory:");
}

export function createFileDatabase(filename: string): DatabaseSync {
  return new DatabaseSync(filename);
}

export function createDefaultAdapter(): SQLiteAdapter {
  const db = createInMemoryDatabase();
  return new SQLiteAdapter(db);
}
