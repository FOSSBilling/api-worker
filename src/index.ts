import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import centralAlertsV1 from "./central-alerts/v1";
import releasesV1 from "./releases/v1";
import versionsV1 from "./versions/v1";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(contextStorage());

app.route("/releases/v1", releasesV1);
app.route("/central-alerts/v1", centralAlertsV1);
app.route("/versions/v1", versionsV1);

// Handle unknown routes
app.all("/*", (c) => {
  return c.json(
    {
      result: null,
      error: {
        message: "Route not found",
        code: "ROUTE_NOT_FOUND"
      }
    },
    404
  );
});

export default app;
