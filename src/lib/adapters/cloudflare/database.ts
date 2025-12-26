import { IDatabase, IPreparedStatement } from "../../interfaces";

export class CloudflareD1Adapter implements IDatabase {
  constructor(private d1: D1Database) {}

  prepare(query: string): IPreparedStatement {
    return new CloudflareD1Statement(this.d1.prepare(query));
  }

  async batch(statements: IPreparedStatement[]): Promise<unknown[]> {
    const d1Statements = statements.map((stmt) => {
      if (stmt instanceof CloudflareD1Statement) {
        return stmt.getNativeStatement();
      }
      throw new Error("Invalid statement type for D1 batch");
    });
    return this.d1.batch(d1Statements);
  }
}

class CloudflareD1Statement implements IPreparedStatement {
  constructor(private stmt: D1PreparedStatement) {}

  bind(...params: unknown[]): IPreparedStatement {
    this.stmt = this.stmt.bind(...params);
    return this;
  }

  async all<T = unknown>(): Promise<{
    results?: T[];
    success: boolean;
    error?: string;
  }> {
    const result = await this.stmt.all<T>();
    return {
      results: result.results,
      success: result.success,
      error: result.error ? String(result.error) : undefined
    };
  }

  async first<T = unknown>(): Promise<T | null> {
    return this.stmt.first<T>();
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
    const result = await this.stmt.run();
    return {
      success: result.success,
      error: result.error ? String(result.error) : undefined,
      meta: result.meta ? { ...result.meta } : undefined
    };
  }

  getNativeStatement(): D1PreparedStatement {
    return this.stmt;
  }
}
