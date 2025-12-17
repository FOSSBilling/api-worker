import { Hono } from "hono";
import { contextStorage } from "hono/context-storage";
import { HTTPException } from "hono/http-exception";
import centralAlertsV1 from "./central-alerts/v1";
import releasesV1 from "./releases/v1";
import versionsV1 from "./versions/v1";
import { platformMiddleware } from "./platform/middleware";
import { createCloudflareBindings } from "./platform/adapters/cloudflare";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(contextStorage());

app.use("*", async (c, next) => {
  const bindings = createCloudflareBindings(c.env);
  const middleware = platformMiddleware(bindings);
  return middleware(c, next);
});

app.route("/releases/v1", releasesV1);
app.route("/central-alerts/v1", centralAlertsV1);
app.route("/versions/v1", versionsV1);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json(
    {
      result: null,
      error: {
        message: err.message || "Internal Server Error",
        code: "INTERNAL_SERVER_ERROR"
      }
    },
    500
  );
});

// Handle root path
app.get("/", (c) => {
  return c.json({
    result: null,
    error: null,
    message: "FOSSBilling API Worker. See https://github.com/FOSSBilling/api-worker for documentation."
  });
});

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
