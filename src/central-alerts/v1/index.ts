import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { CentralAlertsDatabase } from "./database";
import { CentralAlert } from "./interfaces";

type CreateAlertRequest = Omit<CentralAlert, "id"> & { id?: string };

const centralAlertsV1 = new Hono<{ Bindings: CloudflareBindings }>();

centralAlertsV1.use(trimTrailingSlash());

const validateRequiredFields = (body: CreateAlertRequest) => {
  const requiredFields = [
    "title",
    "message",
    "type",
    "min_fossbilling_version",
    "max_fossbilling_version",
    "datetime"
  ];

  for (const field of requiredFields) {
    if (!body[field as keyof CreateAlertRequest]) {
      return {
        json: {
          result: null,
          error: {
            message: `Missing required field: ${field}`,
            code: "VALIDATION_ERROR"
          }
        },
        status: 400 as const
      };
    }
  }
  return null;
};

// GET /list - Get all alerts
centralAlertsV1.get("/list", async (c) => {
  const db = new CentralAlertsDatabase(c.env.DB_CENTRAL_ALERTS);
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

// GET /version/:version - Get alerts for specific FOSSBilling version
centralAlertsV1.get("/version/:version", async (c) => {
  const version = c.req.param("version");
  const db = new CentralAlertsDatabase(c.env.DB_CENTRAL_ALERTS);
  const { data, error } = await db.getAlertsByVersion(version);

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

// GET /:id - Get specific alert by ID
centralAlertsV1.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = new CentralAlertsDatabase(c.env.DB_CENTRAL_ALERTS);
  const { data, error } = await db.getAlertById(id);

  if (error) {
    return c.json(
      {
        result: null,
        error: {
          message: error.message,
          code: error.code || "DATABASE_ERROR"
        }
      },
      error.message === "Alert not found" ? 404 : 500
    );
  }

  return c.json({
    result: { alert: data },
    error: null
  });
});

// POST / - Create new alert (requires authentication)
centralAlertsV1.post("/", async (c) => {
  const body: CreateAlertRequest = await c.req.json();
  const db = new CentralAlertsDatabase(c.env.DB_CENTRAL_ALERTS);

  const validationError = validateRequiredFields(body);
  if (validationError) {
    c.status(validationError.status);
    return c.json(validationError.json);
  }

  const { data, error } = await db.createAlert(body);

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

  return c.json(
    {
      result: { alert: data },
      error: null
    },
    201
  );
});

// PUT /:id - Update existing alert (requires authentication)
centralAlertsV1.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body: CreateAlertRequest = await c.req.json();
  const db = new CentralAlertsDatabase(c.env.DB_CENTRAL_ALERTS);

  const { data, error } = await db.updateAlert(id, body);

  if (error) {
    return c.json(
      {
        result: null,
        error: {
          message: error.message,
          code: error.code || "DATABASE_ERROR"
        }
      },
      error.message === "Alert not found" ? 404 : 500
    );
  }

  return c.json({
    result: { alert: data },
    error: null
  });
});

// DELETE /:id - Delete alert (requires authentication)
centralAlertsV1.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = new CentralAlertsDatabase(c.env.DB_CENTRAL_ALERTS);

  const { error } = await db.deleteAlert(id);

  if (error) {
    return c.json(
      {
        result: null,
        error: {
          message: error.message,
          code: error.code || "DATABASE_ERROR"
        }
      },
      error.message === "Alert not found" ? 404 : 500
    );
  }

  return c.json({
    result: { success: true },
    error: null
  });
});

export default centralAlertsV1;
