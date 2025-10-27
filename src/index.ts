/**
 * FOSSBilling API Worker
 * 
 * This serves as a central API for the FOSSBilling ecosystem, providing:
 * - Version Service – Retrieve available FOSSBilling releases and version details from GitHub.
 * - Releases Service – Get release information with support status tracking (deprecated, maintained for backward compatibility).
 * - Central Alerts Service – Manage and distribute system-wide alerts to FOSSBilling instances.
 * 
 * @license AGPL-3.0
 */

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
