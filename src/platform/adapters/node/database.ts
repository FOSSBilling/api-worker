import { IDatabase, IPreparedStatement } from "../../interfaces";
import { DatabaseSync } from "node:sqlite";

export class SQLiteAdapter implements IDatabase {
  constructor(private db: DatabaseSync) {}

  prepare(query: string): IPreparedStatement {
    return new SQLiteStatement(this.db, query);
  }

  async batch(statements: IPreparedStatement[]): Promise<unknown[]> {
    const results = [];
    for (const stmt of statements) {
      if (stmt instanceof SQLiteStatement) {
        const result = await stmt.run();
        results.push(result);
      } else {
        throw new Error("Invalid statement type for SQLite batch");
      }
    }
    return results;
  }
}

class SQLiteStatement implements IPreparedStatement {
  private params: unknown[] = [];

  constructor(
    private db: DatabaseSync,
    private query: string
  ) {}

  bind(...params: unknown[]): IPreparedStatement {
    this.params = params;
    return this;
  }

  async all<T = unknown>(): Promise<{ results?: T[]; success: boolean }> {
    const statement = this.db.prepare(this.query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = statement.all(...(this.params as any[]));

    return {
      results: results as T[],
      success: true
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    const statement = this.db.prepare(this.query);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = statement.get(...(this.params as any[]));
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
    try {
      const statement = this.db.prepare(this.query);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = statement.run(...(this.params as any[]));

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
  return new DatabaseSync(filename);
}

export function createDefaultAdapter(): SQLiteAdapter {
  const db = createInMemoryDatabase();
  return new SQLiteAdapter(db);
}
