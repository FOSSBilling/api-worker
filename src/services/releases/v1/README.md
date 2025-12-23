# Releases Service (Deprecated)

**Base Path:** `/releases/v1`

This service is deprecated and scheduled for removal on **December 31, 2025**. New implementations should use the Versions Service instead.

The Releases service provides FOSSBilling release information with basic support status tracking. It was originally created to help installations determine if they're running supported versions, but the Versions Service now offers more comprehensive functionality.

## Deprecation Notice

All responses from this service include HTTP deprecation headers:

- `Deprecation: true`
- `Sunset: Wed, 31 Dec 2025 23:59:59 UTC`
- `Link: </versions/v1>; rel="successor-version"`

These headers allow automated tools and clients to detect the deprecation and plan for migration.

## Endpoints

### GET `/`

Returns all FOSSBilling releases with a simple support status classification.

This endpoint fetches release data from the Versions Service and adds a basic `support` field to each version. The support status is determined by comparing each version to the latest release:

- Latest version: `latest`
- Versions with only patch-level differences: `outdated`
- All other versions: `insecure`

**Request:**

```http
GET /releases/v1
```

**Response:**

```json
{
  "result": {
    "versions": [
      {
        "version": "0.5.0",
        "support": "insecure"
      },
      {
        "version": "0.7.2",
        "support": "latest"
      }
    ]
  },
  "error": null
}
```

## Migration Guide

To migrate to the Versions Service, replace calls to `/releases/v1` with `/versions/v1`. The Versions Service provides the same information plus additional details like download URLs, PHP requirements, changelogs, and file sizes. See the [Versions Service documentation](../versions/v1/README.md) for details.
