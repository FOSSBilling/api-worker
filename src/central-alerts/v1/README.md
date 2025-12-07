# Central Alerts v1

A clean, JSON-based central alerts system for FOSSBilling.

## Database Setup

```bash
npm run db:init
```

## API Endpoints

- `GET /list` - Get all alerts
- `GET /version/:version` - Get alerts for specific FOSSBilling version
- `GET /:id` - Get specific alert by ID
- `POST /` - Create new alert
- `PUT /:id` - Update existing alert
- `DELETE /:id` - Delete alert

## Data Structure

```json
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
      "link": "https://example.com",
      "type": "info"
    }
  ],
  "datetime": "2023-06-30T21:43:03+00:00"
}
```

## Development

```bash
npm run dev
npm run deploy
npm test
```
