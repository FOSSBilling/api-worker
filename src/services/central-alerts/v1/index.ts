import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { CentralAlertsDatabase } from "./database";
import { getPlatform } from "../../../lib/middleware";

const centralAlertsV1 = new Hono<{ Bindings: CloudflareBindings }>();

centralAlertsV1.use(trimTrailingSlash());

centralAlertsV1.get("/list", async (c) => {
  const platform = getPlatform(c);
  const db = new CentralAlertsDatabase(
    platform.getDatabase("DB_CENTRAL_ALERTS")
  );
  const { data, error } = await db.getAllAlerts();

  if (error) {
    return c.json(
      {
        result: null,
        error: {
          message: error.message,
          code: error.code || "DATABASE_ERROR"
        }
      },
      500
    );
  }

  return c.json({
    result: { alerts: data || [] },
    error: null
  });
});

export default centralAlertsV1;
