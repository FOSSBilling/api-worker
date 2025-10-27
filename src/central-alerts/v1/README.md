# Central Alerts Service

**Base Path:** `/central-alerts/v1`

## GET `/list`

Retrieve all active system alerts.

**Response:**

```json
{
  "result": {
    "alerts": [
      {
        "id": "string",
        "title": "string",
        "message": "string",
        "type": "success|info|warning|danger",
        "dismissible": true,
        "min_fossbilling_version": "x.x.x",
        "max_fossbilling_version": "x.x.x",
        "include_preview_branch": false,
        "buttons": [
          { "text": "string", "link": "string", "type": "success|info|warning|danger" }
        ],
        "datetime": "2025-10-27T00:00:00.000Z"
      }
    ]
  },
  "error": null
}
```
