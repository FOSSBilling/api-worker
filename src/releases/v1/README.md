# Releases Service (Deprecated)

**Base Path:** `/releases/v1`

**Important:** This service is deprecated and will be removed after **31 December 2025**. Use the [Versions Service](../versions/v1/README.md) instead.

Provides FOSSBilling release information with support status tracking. This service is maintained for backward compatibility but new implementations should use the Versions Service.

## Deprecation Notice

This service includes HTTP deprecation headers:

- `Deprecation` header with timestamp
- `Sunset` header indicating removal date (December 31, 2025)

## Endpoints

### GET `/`

Retrieve all releases with support status information. This endpoint fetches data from the Versions Service and adds support status classification.

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
        "version": "x.x.x",
        "support": "supported|unsupported"
      }
    ]
  },
  "error": null
}
```
