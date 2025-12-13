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

**Note**: The `/update` endpoint requires a bearer token that is stored in KV storage. See [Configuration](#configuration) for details.

**Response Format**:

```json
{
  "result": {
    /* data */
  },
  "error_code": 0,
  "message": null
}
```

### Releases Service (`/releases/v1`) - Deprecated

- `GET /releases/v1` - Get releases with support status (deprecated, use versions service instead)

**Note**: This service returns deprecation headers and will be sunset on December 31, 2025.

### Central Alerts Service (`/central-alerts/v1`)

- `GET /central-alerts/v1/list` - Get all active system alerts
- `GET /central-alerts/v1/version/:version` - Get alerts for a specific FOSSBilling version
- `GET /central-alerts/v1/:id` - Get a specific alert by ID
- `POST /central-alerts/v1/` - Create a new alert (admin only)
- `PUT /central-alerts/v1/:id` - Update an existing alert (admin only)
- `DELETE /central-alerts/v1/:id` - Delete an alert (admin only)

**Alert Structure**:

```json
{
  "id": "string",
  "title": "string",
  "message": "string",
  "type": "success|info|warning|danger",
  "dismissible": boolean,
  "min_fossbilling_version": "string",
  "max_fossbilling_version": "string",
  "include_preview_branch": boolean,
  "buttons": [
    {
      "text": "string",
      "link": "string",
      "type": "success|info|warning|danger"
    }
  ],
  "datetime": "ISO 8601 timestamp"
}
```

## Configuration

### KV Namespaces

The worker uses two KV namespaces:

- **CACHE_KV**: Stores cached GitHub releases data (key: `gh-fossbilling-releases`)
- **AUTH_KV**: Stores authentication tokens (key: `update_token`)

### D1 Database

The worker uses a D1 database for central alerts:

- **DB_CENTRAL_ALERTS**: Stores system-wide alerts with version targeting

### Environment Variables

- **GITHUB_TOKEN**: Required for GitHub API access

### Setting Up UPDATE_TOKEN

To configure the update endpoint authentication:

```bash
# Store your UPDATE_TOKEN in AUTH_KV
npx wrangler kv:key put --binding=AUTH_KV "update_token" "your-secure-token-here"
```

### Database Initialization

To initialize the central alerts database:

```bash
# Run the database initialization script
npm run init:db
```

This will create the necessary tables and insert sample data.

## Development

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up your environment variables in `.dev.vars`:

   ```
   GITHUB_TOKEN="your-github-token"
   UPDATE_TOKEN="your-update-token"
   ```

3. Initialize the database:
   ```bash
   npm run init:db
   ```

### Available Scripts

- `npm run dev` - Start the development server
- `npm run deploy` - Deploy to production
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Run TypeScript type checking
- `npm run init:db` - Initialize the central alerts database

### Local Development

1. Start the development server:

   ```bash
   npm run dev
   ```

2. The worker will be available at `http://localhost:8787`

3. Test the endpoints:

   ```bash
   # Get all versions
   curl http://localhost:8787/versions/v1

   # Get latest version
   curl http://localhost:8787/versions/v1/latest

   # Get alerts
   curl http://localhost:8787/central-alerts/v1/list
   ```

## Response Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing bearer token)
- `404` - Not Found (resource doesn't exist or route not found)
- `500` - Internal Server Error

## Error Response Format

```json
{
  "result": null,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```
