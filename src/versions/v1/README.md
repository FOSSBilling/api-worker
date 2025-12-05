# Versions Service

**Base Path:** `/versions/v1`

Provides comprehensive FOSSBilling version management, including release information, download URLs, PHP version requirements, changelogs, and administrative cache management.

## Authentication

- **Cache Update**: Bearer token authentication required for `/update` endpoint

## Endpoints

### GET `/`

Retrieve all available FOSSBilling releases from GitHub with detailed information including download URLs, PHP requirements, and metadata.

**Request:**

```http
GET /versions/v1
```

**Response:**

```json
{
  "result": {
    "x.x.x": {
      "version": "string",
      "released_on": "2025-10-27T00:00:00Z",
      "minimum_php_version": "string",
      "download_url": "https://...",
      "size_bytes": 12345678,
      "is_prerelease": false,
      "github_release_id": 123456789,
      "changelog": "string"
    }
  },
  "error_code": 0,
  "message": null
}
```

**Response Fields:**

- `result` (object) - Map of version numbers to release details
  - `version` (string) - Human-readable version number
  - `released_on` (string) - ISO 8601 release timestamp
  - `minimum_php_version` (string) - Minimum required PHP version
  - `download_url` (string) - Direct download URL for FOSSBilling.zip
  - `size_bytes` (number) - File size in bytes
  - `is_prerelease` (boolean) - Whether this is a pre-release version
  - `github_release_id` (number) - GitHub release ID
  - `changelog` (string) - Release notes and changelog

### GET `/:version`

Retrieve details for a specific FOSSBilling release. Supports special parameter `latest` to get the most recent release.

**Request:**

```http
GET /versions/v1/:version
```

**Parameters:**

- `version` (path parameter) - Version number (e.g., "0.5.1") or "latest"

**Response:**

```json
{
  "result": {
    "version": "x.x.x",
    "released_on": "2025-10-27T00:00:00Z",
    "minimum_php_version": "string",
    "download_url": "https://...",
    "size_bytes": 12345678,
    "is_prerelease": false,
    "github_release_id": 123456789,
    "changelog": "string"
  },
  "error_code": 0,
  "message": null
}
```

### GET `/build_changelog/:current`

Build a combined changelog from the current version to the latest release. Useful for showing users what has changed since their current version.

**Request:**

```http
GET /versions/v1/build_changelog/:current
```

**Parameters:**

- `current` (path parameter) - Current version (must be valid semantic version)

**Response:**

```json
{
  "result": "string", // Combined changelog text
  "error_code": 0,
  "message": null
}
```

**Example:**

```http
GET /versions/v1/build_changelog/0.5.0
```

Returns changelogs for all versions newer than 0.5.0, concatenated together.

### GET `/update`

Force update the releases cache by fetching fresh data from GitHub. Requires bearer token authentication.

**Request:**

```http
GET /versions/v1/update
Authorization: Bearer YOUR_UPDATE_TOKEN
```

**Response:**

```json
{
  "result": "Releases cache updated successfully with X releases.",
  "error_code": 0,
  "message": null
}
```

## Response Examples

### Get All Versions

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

### Get Latest Version

```http
GET /versions/v1/latest
```

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
