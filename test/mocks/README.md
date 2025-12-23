# Test Mocks

This directory contains mock implementations and mock data used across the test suite.

## Contents

- `mock-adapters.ts` - Mock implementations for database, cache, and environment adapters
- `github-releases.ts` - Mock GitHub API release data
- `releases.ts` - Processed release mock data for testing releases API

## Usage

Mock adapters are used in unit tests to simulate Cloudflare Workers bindings (D1, KV, environment variables) without requiring actual Cloudflare infrastructure.
