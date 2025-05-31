import { Hono } from "hono";
import centralAlertsV1 from './central-alerts/v1';
import releasesV1 from "./releases/v1";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Release Service
app.route("/releases/v1", releasesV1);

// Central Alert Service
app.route("/central-alerts/v1", centralAlertsV1);

export default app;
