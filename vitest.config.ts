import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    // Test timeout configuration
    testTimeout: 30000, // 30 seconds max per test
    hookTimeout: 30000, // 30 seconds max for hooks (beforeEach, afterEach)

    // Code coverage configuration
    // Note: Native V8 coverage is not supported with @cloudflare/vitest-pool-workers
    // Must use instrumented Istanbul coverage instead per Cloudflare documentation
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: [
        "src/**",
        "test/**/*.test.ts"
      ],
    },

    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Add test environment variables
          bindings: {
            GITHUB_TOKEN: "test-github-token",
            UPDATE_TOKEN: "test-update-token",
          },
        },
      },
    },
  },
});