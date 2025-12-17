import { ICache, CacheOptions } from "../../interfaces";

export class CloudflareKVAdapter implements ICache {
  constructor(
    private kv: KVNamespace,
    private bindingName: string = "UNKNOWN_KV"
  ) {
    if (!kv) {
      throw new Error(
        `CloudflareKVAdapter initialized with undefined KVNamespace for binding: ${bindingName}. Check your wrangler.toml or environment variables.`
      );
    }
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key);
  }

  async put(key: string, value: string, options?: CacheOptions): Promise<void> {
    await this.kv.put(key, value, options);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}
