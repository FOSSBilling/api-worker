# Versions Service

**Base Path:** `/versions/v1`

## GET `/`

Retrieve all available FOSSBilling releases from GitHub.

**Response:**

```json
{
  "result": ["x.x.x", "x.x.x", ...],
  "error_code": 0,
  "message": null
}
```

## GET `/:version`

Retrieve details for a specific FOSSBilling release.

Supports special parameter:

- `version = "latest"` – Get the most recent release

**Response:**

```json
{
  "result": {
    "version": "x.x.x",
    "tag": "v.x.x.x",
    "url": "https://...",
    "prerelease": false,
    "created_at": "2025-10-27T00:00:00Z",
    "published_at": "2025-10-27T00:00:00Z"
  },
  "error_code": 0,
  "message": null
}
```
