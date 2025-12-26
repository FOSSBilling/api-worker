# Versions Service

**Base Path:** `/versions/v1`

Provides release metadata from the FOSSBilling GitHub repo. Responses are cached in `CACHE_KV` for 24 hours.

## Authentication

`/update` requires a bearer token stored in `AUTH_KV` under `UPDATE_TOKEN`.

## Endpoints

### GET `/`

Returns all available releases.

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
    }
  },
  "error_code": 0,
  "message": null
}
```

### GET `/:version`

Get details for a specific release. Use `latest` for the newest release.

**Request:**

```http
GET /versions/v1/0.6.0
GET /versions/v1/latest
```

### GET `/build_changelog/:current`

Returns a combined changelog for all releases newer than `:current`.

**Request:**

```http
GET /versions/v1/build_changelog/0.5.0
```

### GET `/update`

Refreshes the cached release data. Requires bearer auth.

**Request:**

```http
GET /versions/v1/update
Authorization: Bearer YOUR_UPDATE_TOKEN
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

When GitHub is unavailable and no cached data exists:

```json
{
  "result": null,
  "error_code": 503,
  "message": "Unable to fetch releases and no cached data available",
  "details": {
    "http_status": 403,
    "error_code": "rate_limit_error"
  }
}
```

## Notes

- `details` includes the GitHub HTTP status and error code when available.
- `stale: true` indicates cached data served after a failed fetch.
- `GITHUB_TOKEN` is required for GitHub API access.
- Releases before 0.5.0 read `src/composer.json`; newer releases use `composer.json`.
