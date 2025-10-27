# FOSSBilling API Worker

A Cloudflare Worker built with [Hono](https://hono.dev/) providing multiple API endpoints for FOSSBilling version management, release information, and central alerts.

## Overview

- **Version Service** – Retrieve available FOSSBilling releases and version details from GitHub.
- **Releases Service** – Get release information with support status tracking (deprecated, maintained for backward compatibility).
- **Central Alerts Service** – Manage and distribute system-wide alerts to FOSSBilling instances.

## Getting Started

### Prerequisites

- Node.js 24+
- npm or yarn
- Wrangler CLI

### Installation

```bash
npm install
```

### Development

Start the local development server:

```bash
npm run dev
```

This will start a Wrangler dev environment on `http://localhost:8787` by default.

### Running Tests

Execute the test suite:

```bash
npm run tests
```

### Type Generation

Generate TypeScript types based on your Wrangler configuration:

```bash
npm run cf-typegen
```

This creates types for Cloudflare bindings (KV, Durable Objects, etc.) that are used in `CloudflareBindings`.

## Development Guide

### Using Hono with Cloudflare Bindings

The application uses TypeScript generics to provide type safety for Cloudflare bindings:

```typescript
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

## Environment Variables & Secrets

Sensitive data should be stored as secrets using Wrangler:

```bash
npx wrangler secret put MY_SECRET
```

Access secrets in your Worker via `env.MY_SECRET`.
