import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import centralAlertsV1 from './central-alerts/v1';
import releasesV1 from "./releases/v1";
import versionsV1 from "./versions/v1";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Store Hono Context in AsyncLocalStorage to make it globally available.
app.use(contextStorage());

// Release Service
app.route("/releases/v1", releasesV1);

// Central Alert Service
app.route("/central-alerts/v1", centralAlertsV1);

export default app;
