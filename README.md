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

### Releases Service (`/releases/v1`) - Deprecated

- `GET /releases/v1` - Get releases with support status (deprecated, use versions service instead)

### Central Alerts Service (`/central-alerts/v1`)

- `GET /central-alerts/v1/list` - Get all active system alerts
