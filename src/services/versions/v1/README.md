# Versions Service

**Base Path:** `/versions/v1`

The Versions service provides comprehensive information about FOSSBilling releases, including download URLs, PHP version requirements, changelogs, file sizes, and release dates. All data is fetched from GitHub and cached for performance.

## How It Works

The service queries the GitHub API for FOSSBilling releases and extracts information from release assets and repository files. Release data is cached in Cloudflare KV storage with a 24-hour TTL to minimize API calls and improve response times.

## Authentication

The `/update` endpoint requires bearer token authentication to manually trigger cache updates. All other endpoints are public.

## Endpoints

### GET `/`

Returns all available FOSSBilling releases with detailed information. Results are cached for 24 hours.

**Request:**

```http
GET /versions/v1
```

**Response:**

```json
{
  "result": {
    "0.5.0": {
      "version": "0.5.0",
      "released_on": "2023-01-15T12:00:00Z",
      "minimum_php_version": "8.1",
      "download_url": "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.5.0/FOSSBilling.zip",
      "size_bytes": 15485760,
      "is_prerelease": false,
      "github_release_id": 987654321,
      "changelog": "## 0.5.0\n- Major feature updates..."
    },
    "0.6.0": {
      "version": "0.6.0",
      "released_on": "2023-06-20T15:30:00Z",
      "minimum_php_version": "8.1",
      "download_url": "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.6.0/FOSSBilling.zip",
      "size_bytes": 16777216,
      "is_prerelease": false,
      "github_release_id": 123456789,
      "changelog": "## 0.6.0\n- Enhanced security features..."
    }
  },
  "error_code": 0,
  "message": null
}
```

**Response Fields:**

- `result` - Object mapping version numbers to release details
  - `version` - Version string (e.g., "0.5.0")
  - `released_on` - ISO 8601 timestamp of release date
  - `minimum_php_version` - Minimum PHP version required
  - `download_url` - Direct download link for FOSSBilling.zip
  - `size_bytes` - File size in bytes
  - `is_prerelease` - Whether this is a pre-release version
  - `github_release_id` - GitHub's internal release identifier
  - `changelog` - Release notes and changelog content

### GET `/:version`

Get detailed information for a specific release. Use `latest` to get the most recent release.

**Request:**

```http
GET /versions/v1/0.6.0
GET /versions/v1/latest
```

**Parameters:**

- `version` (path) - Version number (e.g., "0.5.1") or the special value "latest"

**Response:**

```json
{
  "result": {
    "version": "0.6.0",
    "released_on": "2023-06-20T15:30:00Z",
    "minimum_php_version": "8.1",
    "download_url": "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.6.0/FOSSBilling.zip",
    "size_bytes": 16777216,
    "is_prerelease": false,
    "github_release_id": 123456789,
    "changelog": "## 0.6.0\n- Enhanced security features..."
  },
  "error_code": 0,
  "message": null
}
```

### GET `/build_changelog/:current`

Generate a combined changelog showing all changes from a specified version to the latest release. This is useful for displaying what's new in an update.

**Request:**

```http
GET /versions/v1/build_changelog/0.5.0
```

**Parameters:**

- `current` (path) - Current version (must be a valid semantic version)

**Response:**

```json
{
  "result": "## 0.6.0\n- Enhanced security features...\n\n## 0.5.1\n- Bug fixes...",
  "error_code": 0,
  "message": null
}
```

The changelog includes all releases newer than the specified version, sorted from newest to oldest. If a release is missing changelog information, a placeholder message is included.

**Error Response (Invalid Version):**

```json
{
  "result": null,
  "error_code": 400,
  "message": "'invalid-version' is not a valid semantic version."
}
```

### GET `/update`

Force a refresh of the cached release data from GitHub. This endpoint requires bearer token authentication.

**Request:**

```http
GET /versions/v1/update
Authorization: Bearer YOUR_UPDATE_TOKEN
```

The update token must be stored in the `AUTH_KV` namespace under the key `update_token`.

**Response:**

```json
{
  "result": "Releases cache updated successfully with 15 releases.",
  "error_code": 0,
  "message": null
}
```

## Error Responses

When a version is not found:

```json
{
  "result": null,
  "error_code": 404,
  "message": "FOSSBilling version 0.999.0 does not appear to exist."
}
```

## Caching

- Cached responses use ETags for efficient client-side caching
- Server-side cache TTL is 24 hours
- Cache can be manually refreshed via the `/update` endpoint
- If GitHub API fails, the service falls back to cached data

## GitHub Integration

The service requires a `GITHUB_TOKEN` environment variable for API access. This token is used to:

- Fetch release information from the FOSSBilling/FOSSBilling repository
- Read composer.json files to determine PHP version requirements
- Access release assets and metadata

For releases before 0.5.0, the composer.json file is located at `src/composer.json`. For 0.5.0 and later, it's in the repository root.
