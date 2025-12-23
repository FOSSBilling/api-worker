import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/node/**/*.test.ts"],
    testTimeout: 10000
  }
});
