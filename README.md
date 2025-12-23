# FOSSBilling API Worker

This is the API service that acts as the central hub for FOSSBilling instances. It handles version checks, update information, and broadcasts system-wide alerts.

Everything is built on [Hono](https://hono.dev), making it lightweight and fast. While we currently deploy this to Cloudflare Workers, the code is designed to be platform-agnostic.

## What it does

The worker exposes three main services:

- **Versions Service** (`/versions/v1`)
  The source of truth for FOSSBilling updates. It fetches release data from GitHub, caches it for performance, and helps instances decide if they need to update.

- **Central Alerts** (`/central-alerts/v1`)
  Allows the project to push critical notifications to all FOSSBilling installations—useful for security hotfixes or major announcements.

- **Releases Service** (`/releases/v1`)
  _Legacy._ This is kept around to support older FOSSBilling versions that haven't updated to the new update system yet. It sends deprecation headers and will eventually be removed.

## Architecture

We've structured the app to separate the core logic from the specific runtime environment (Cloudflare, Node, etc.).

- **Application Logic**: Found in `src/services/versions/v1`, `src/services/central-alerts/v1`, etc. These feature modules don't know they are running on Cloudflare.
- **Platform Layer**: Located in `src/lib`. This defines interfaces for things like Cache, Database, and Environment variables.
- **Adapters**:
- `src/lib/adapters/cloudflare`: Real implementations using KV and D1.
- `src/lib/adapters/node`: Reference implementations (useful for testing or alternative deployments).

## APIs

### Versions (`/versions/v1`)

- `GET /versions/v1` - List all releases.
- `GET /versions/v1/latest` - Get just the newest one.
- `GET /versions/v1/:version` - Get details for a specific version (e.g. `1.0.0`); also supports the `latest` keyword.
- `GET /versions/v1/build_changelog/:current` - Generates a consolidated changelog from your current version up to the latest.
- `GET /versions/v1/update` - Refreshes the releases cache. Requires bearer token authentication using `Authorization: Bearer <UPDATE_TOKEN>`.

### Central Alerts (`/central-alerts/v1`)

- `GET /central-alerts/v1/list` - Public endpoint for fetching active alerts.
- `GET /central-alerts/v1/version/:version` - Fetch alerts targeted at a specific FOSSBilling version.
- **Admin Endpoints**: `POST`, `PUT`, `DELETE` exist but require authentication (controlled by the admin interface).

## Configuration

If you're running this yourself, you'll need a few things set up.

### Storage

We use [Cloudflare D1](https://developers.cloudflare.com/d1/) and [KV](https://developers.cloudflare.com/kv/).

- **D1 Database** (`DB_CENTRAL_ALERTS`): Stores the alert messages.
- **KV Namespace** (`CACHE_KV`): Caches GitHub API responses so we don't hit rate limits.
- **KV Namespace** (`AUTH_KV`): Stores the `update_token` for secured endpoints.

### Environment Variables

- `GITHUB_TOKEN`: A GitHub Personal Access Token (classic) with public repo read access.
- `UPDATE_TOKEN`: A secret token you define to secure release cache updates.

## Development

Get the dependencies installed:

```bash
npm install
```

### Local Setup

1. Create a `.dev.vars` file for your secrets:

   ```env
   GITHUB_TOKEN="your-token"
   UPDATE_TOKEN="dev-secret"
   ```

2. Initialize the local D1 database:

   ```bash
   npm run init:db
   ```

3. Spin up the dev server:
   ```bash
   npm run dev
   ```

You can now hit endpoints at `http://localhost:8787`.

### Testing

We use Vitest for testing. The suite includes unit tests for the endpoints and integration tests using the platform adapters.

```bash
npm run test
```
