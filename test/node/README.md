# Node.js Adapter Testing

This directory contains Node.js-specific unit tests for adapters that use Node.js built-in modules (like `node:sqlite`) which are not supported in the Cloudflare Workers test environment.

## Running Tests

```bash
# Run only Node.js tests
npm run test:node

# Run all tests (Cloudflare + Node.js)
npm run test:all

# Run Cloudflare tests only (default)
npm test
```

## Test Structure

- `test/unit/` - Cloudflare Workers environment tests (via `@cloudflare/vitest-pool-workers`)
- `test/node/` - Node.js environment tests (via Vitest with `environment: "node"`)
- `test/integration/` - Integration tests running in Cloudflare Workers environment

## Why Separate Test Environments?

The Cloudflare Workers runtime does not support Node.js built-in modules like:

- `node:sqlite`
- `node:fs`
- `node:path`

These tests ensure the SQLite-based adapters work correctly in Node.js environments while keeping the main test suite focused on the Cloudflare Workers deployment target.
