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

### GET `/version/:version`

Get alerts applicable to a specific FOSSBilling version. The service filters alerts based on the version range specified in each alert.

**Parameters:**

- `version` (path) - FOSSBilling version (e.g., "0.5.1")

**Response:**

```json
{
  "result": {
    "alerts": [...]
  },
  "error": null
}
```

### GET `/:id`

Retrieve a specific alert by its ID.

**Parameters:**

- `id` (path) - Alert ID

**Response:**

```json
{
  "result": {
    "alert": {
      "id": "1",
      "title": "Security Alert",
      ...
    }
  },
  "error": null
}
```

### POST `/`

Create a new alert. Requires all mandatory fields.

**Request Body:**

```json
{
  "title": "Security Alert",
  "message": "Please update your installation",
  "type": "danger",
  "dismissible": false,
  "min_fossbilling_version": "0.0.0",
  "max_fossbilling_version": "0.5.2",
  "include_preview_branch": false,
  "datetime": "2023-06-30T21:43:03+00:00"
}
```

**Required Fields:** `title`, `message`, `type`, `min_fossbilling_version`, `max_fossbilling_version`, `datetime`

**Response:**

```json
{
  "result": {
    "alert": {...}
  },
  "error": null
}
```

### PUT `/:id`

Update an existing alert.

**Parameters:**

- `id` (path) - Alert ID

**Request Body:** Same structure as POST

**Response:**

```json
{
  "result": {
    "alert": {...}
  },
  "error": null
}
```

### DELETE `/:id`

Delete an alert by ID.

**Parameters:**

- `id` (path) - Alert ID

**Response:**

```json
{
  "result": {
    "success": true
  },
  "error": null
}
```

## Alert Types

The `type` field accepts: `success`, `info`, `warning`, `danger`

## Database

Uses D1 database binding `DB_CENTRAL_ALERTS`. Initialize with the setup script in `src/central-alerts/v1/scripts/`.
