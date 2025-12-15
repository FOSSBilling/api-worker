import {
  IDatabase,
  IPreparedStatement,
  ICache,
  IEnvironment
} from "../../src/platform/interfaces";

export class MockDatabaseAdapter implements IDatabase {
  private data = new Map<string, unknown[]>();

  constructor(initialData?: Record<string, unknown[]>) {
    if (initialData) {
      Object.entries(initialData).forEach(([table, rows]) => {
        this.data.set(table, rows);
      });
    }
  }

  prepare(query: string): IPreparedStatement {
    return new MockPreparedStatement(query, this.data);
  }

  async batch(statements: IPreparedStatement[]): Promise<unknown[]> {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  }

  setTableData(table: string, rows: unknown[]): void {
    this.data.set(table, rows);
  }

  getTableData(table: string): unknown[] {
    return this.data.get(table) || [];
  }

  clearTable(table: string): void {
    this.data.delete(table);
  }

  clearAll(): void {
    this.data.clear();
  }
}

class MockPreparedStatement implements IPreparedStatement {
  private params: unknown[] = [];

  constructor(
    private query: string,
    private data: Map<string, unknown[]>
  ) {}

  bind(...params: unknown[]): IPreparedStatement {
    this.params = params;
    return this;
  }

  async all<T = unknown>(): Promise<{ results?: T[]; success: boolean }> {
    try {
      const fromMatch = this.query.match(/FROM\s+(\w+)/i);
      const tableName = fromMatch ? fromMatch[1] : "central_alerts";
      const results = this.data.get(tableName) || [];
      return { results: results as T[], success: true };
    } catch {
      return { results: undefined, success: false };
    }
  }

  async first<T = unknown>(): Promise<T | null> {
    const result = await this.all<T>();
    return result.results?.[0] || null;
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
      return {
        success: true,
        meta: { changes: 1 }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export class MockCacheAdapter implements ICache {
  private store = new Map<string, { value: string; expiry?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiry && entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    let expiry: number | undefined;

    if (options?.expirationTtl) {
      expiry = Date.now() + options.expirationTtl * 1000;
    }

    this.store.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  size(): number {
    return this.store.size;
  }
}

export class MockEnvironmentAdapter implements IEnvironment {
  constructor(private vars: Record<string, string> = {}) {}

  get(key: string): string | undefined {
    return this.vars[key];
  }

  has(key: string): boolean {
    return key in this.vars;
  }

  set(key: string, value: string): void {
    this.vars[key] = value;
  }

  delete(key: string): void {
    delete this.vars[key];
  }

  clear(): void {
    this.vars = {};
  }

  getAll(): Record<string, string> {
    return { ...this.vars };
  }
}
