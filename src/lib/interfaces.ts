export interface DatabaseError {
  message: string;
  code?: string;
}

export interface DatabaseResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface IDatabase {
  prepare(query: string): IPreparedStatement;
  batch?(statements: IPreparedStatement[]): Promise<unknown[]>;
}

export interface IPreparedStatement {
  bind(...params: unknown[]): IPreparedStatement;
  all<T = unknown>(): Promise<{ results?: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{
    success: boolean;
    error?: string;
    meta?: {
      changes?: number;
      last_row_id?: number;
      [key: string]: unknown;
    };
  }>;
}

export interface CacheOptions {
  expirationTtl?: number;
  expiration?: number;
}

export interface ICache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IEnvironment {
  get(key: string): string | undefined;
  has(key: string): boolean;
}

export interface IPlatformBindings {
  databases: Record<string, IDatabase>;
  caches: Record<string, ICache>;
  environment: IEnvironment;
}
