# FOSSBilling API Worker

Cloudflare Worker providing multiple API endpoints for FOSSBilling version management, release information, and central alerts.

## Overview

This worker provides three main services:

- **Versions Service** – Retrieve available FOSSBilling releases and version details from GitHub, including download URLs, PHP version requirements, and changelogs.
- **Releases Service** – Get release information with support status tracking (deprecated, maintained for backward compatibility).
- **Central Alerts Service** – Manage and distribute system-wide alerts to FOSSBilling instances.

## API Endpoints

### Versions Service (`/versions/v1`)

- `GET /versions/v1` - Get all available FOSSBilling releases
- `GET /versions/v1/:version` - Get details for a specific version (supports `latest`)
- `GET /versions/v1/build_changelog/:current` - Build changelog from current version to latest
- `GET /versions/v1/update` - Update releases cache (requires bearer token)

**Note**: The `/update` endpoint requires a bearer token that is now stored in KV storage instead of environment variables. See [Migration Guide](#migration-guide) for details.

### Releases Service (`/releases/v1`) - Deprecated

- `GET /releases/v1` - Get releases with support status (deprecated, use versions service instead)

### Central Alerts Service (`/central-alerts/v1`)

- `GET /central-alerts/v1/list` - Get all active system alerts

## Configuration

### KV Namespaces

The worker uses two KV namespaces:

- **CACHE_KV**: Stores cached GitHub releases data (key: `gh-fossbilling-releases`)
- **AUTH_KV**: Stores authentication tokens (key: `update_token`)

### Environment Variables

- **GITHUB_TOKEN**: Required for GitHub API access

### Setting Up UPDATE_TOKEN

To configure the update endpoint authentication:

```bash
# Store your UPDATE_TOKEN in AUTH_KV
npx wrangler kv:key put --binding=AUTH_KV "update_token" "your-secure-token-here"
```

The token will be used for bearer authentication on the `/versions/v1/update` endpoint.
