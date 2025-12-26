# Central Alerts v1

**Base Path:** `/central-alerts/v1`

The Central Alerts service provides targeted notifications to FOSSBilling installations based on version ranges. This allows administrators to push important security alerts, update notices, or general announcements to specific versions of FOSSBilling.

## API Endpoints

### GET `/list`

Retrieve all alerts in the system.

**Response:**

```json
{
  "result": {
    "alerts": [
      {
        "id": "1",
        "title": "Security Alert",
        "message": "Please update your installation",
        "type": "danger",
        "dismissible": false,
        "min_fossbilling_version": "0.0.0",
        "max_fossbilling_version": "0.5.2",
        "include_preview_branch": false,
        "buttons": [
          {
            "text": "Learn More",
            "link": "https://fossbilling.org/security",
            "type": "info"
          }
        ],
        "datetime": "2023-06-30T21:43:03+00:00"
      }
    ]
  },
  "error": null
}
```

**Error Response:**

```json
{
  "result": null,
  "error": {
    "message": "Database connection failed",
    "code": "DATABASE_ERROR"
  }
}
```

## Alert Types

The `type` field accepts: `success`, `info`, `warning`, `danger`

## Database

Uses D1 database binding `DB_CENTRAL_ALERTS`. Initialize with the setup script in `src/services/central-alerts/v1/scripts/`.
