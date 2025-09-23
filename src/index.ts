import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import centralAlertsV1 from './central-alerts/v1';
import releasesV1 from "./releases/v1";
import versionsV1 from "./versions/v1";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Store Hono Context in AsyncLocalStorage to make it globally available.
app.use(contextStorage());

// Release Service (v1) - obsolete, kept for backward compatibility (sunset date: 31-Dec-2025).
app.route("/releases/v1", releasesV1);

// Central Alert Service - current Central Alert service.
app.route("/central-alerts/v1", centralAlertsV1);

// Version Service (v1) - current version service.
app.route("/versions/v1", versionsV1);

export default app;
