/**
 * Central Alerts API - v1
 * 
 * This module defines the Central Alerts API.
 * It provides an endpoint to retrieve a list of system-wide alerts
 * that can be consumed by FOSSBilling instances.
 * 
 * @license AGPL-3.0
 */

import { Hono } from 'hono';
import { trimTrailingSlash } from 'hono/trailing-slash'
import { CentralAlerts } from './data';

const centralAlertsV1 = new Hono<{ Bindings: CloudflareBindings }>();

centralAlertsV1.use(trimTrailingSlash())
centralAlertsV1.get('/list', (c) => {
    c.status(200);
    return c.json({
      result: {
        alerts: CentralAlerts
      },
      error: null
    })
});

export default centralAlertsV1;