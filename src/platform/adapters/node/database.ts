// Reference implementation for PostgreSQL
// Install pg: npm install pg @types/pg

import { IDatabase, IPreparedStatement } from "../../interfaces";

interface PostgresResult {
  rows: unknown[];
  rowCount?: number | null;
}

interface PostgresPool {
  query(text: string, params: unknown[]): Promise<PostgresResult>;
}

export class PostgreSQLAdapter implements IDatabase {
  constructor(private pool: PostgresPool) {}

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
    private pool: PostgresPool,
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
    const result = await this.pool.query(this.query, this.params);
    return {
      results: result.rows as T[],
      success: true
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = await this.pool.query(this.query, this.params);
    return (result.rows[0] as T) || null;
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
