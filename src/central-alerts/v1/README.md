# Central Alerts Service

**Base Path:** `/central-alerts/v1`

Provides system-wide alerts for FOSSBilling instances, allowing distribution of important security notices, update reminders, and other critical information.

## Endpoints

### GET `/list`

Retrieve all active system alerts. Alerts are statically defined and include security vulnerabilities, update notifications, and other important system information.

**Request:**

```http
GET /central-alerts/v1/list
```

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
          { 
            "text": "string", 
            "link": "string", 
            "type": "success|info|warning|danger" 
          }
        ],
        "datetime": "2025-10-27T00:00:00.000Z"
      }
    ]
  },
  "error": null
}
```

**Response Fields:**

- `alerts` (array) - List of active alerts
  - `id` (string) - Unique identifier for the alert
  - `title` (string) - Alert title displayed to users
  - `message` (string) - Detailed alert message
  - `type` (string) - Alert severity: `success`, `info`, `warning`, or `danger`
  - `dismissible` (boolean) - Whether users can dismiss the alert
  - `min_fossbilling_version` (string) - Minimum FOSSBilling version this alert applies to
  - `max_fossbilling_version` (string) - Maximum FOSSBilling version this alert applies to
  - `include_preview_branch` (boolean) - Whether to show on preview/beta branches
  - `buttons` (array, optional) - Action buttons for the alert
    - `text` (string) - Button text
    - `link` (string) - Button URL
    - `type` (string, optional) - Button style type
  - `datetime` (string) - ISO 8601 timestamp when the alert was created
