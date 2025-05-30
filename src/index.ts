import { Hono } from "hono";
import centralAlertsV1 from './central-alerts/v1';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Central Alerts Service
app.route("/central-alerts/v1", centralAlertsV1);

export default app;
