import { Hono } from 'hono';
import { trimTrailingSlash } from 'hono/trailing-slash'
import { CentralAlerts } from './data';

const centralAlertsV1 = new Hono<{ Bindings: CloudflareBindings }>();

centralAlertsV1.use(trimTrailingSlash())
centralAlertsV1.get('/list', (c) => {
    return c.json({
      result: {
        alerts: CentralAlerts
      },
      error: null
    })
});

export default centralAlertsV1;