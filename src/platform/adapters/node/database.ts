// Reference implementation for PostgreSQL
// Install pg: npm install pg @types/pg

import { IDatabase, IPreparedStatement } from "../../interfaces";

export class PostgreSQLAdapter implements IDatabase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private pool: any) {}

  prepare(query: string): IPreparedStatement {
    return new PostgreSQLStatement(this.pool, query);
  }

  async batch(statements: IPreparedStatement[]): Promise<unknown[]> {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }
}

class PostgreSQLStatement implements IPreparedStatement {
  private params: unknown[] = [];
  private query: string;

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private pool: any,
    query: string
  ) {
    let paramIndex = 1;
    this.query = query.replace(/\?/g, () => `$${paramIndex++}`);
  }

  bind(...params: unknown[]): IPreparedStatement {
    this.params = params;
    return this;
  }

  async all<T = unknown>(): Promise<{ results?: T[]; success: boolean }> {
    try {
      const result = await this.pool.query(this.query, this.params);
      return {
        results: result.rows as T[],
        success: true
      };
    } catch {
      return {
        results: undefined,
        success: false
      };
    }
  }

  async first<T = unknown>(): Promise<T | null> {
    try {
      const result = await this.pool.query(this.query, this.params);
      return (result.rows[0] as T) || null;
    } catch {
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
      const result = await this.pool.query(this.query, this.params);
      return {
        success: true,
        meta: {
          changes: result.rowCount ?? 0
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
