import { describe, it, expect, beforeEach } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import app from "../../../../src";
import { mockD1Database } from "../../../utils/d1-mock";
import type { CentralAlertsResponse } from "../../../utils/test-types";

describe("Central Alerts API v1", () => {
  beforeEach(() => {
    // Mock the D1 database binding
    env.DB_CENTRAL_ALERTS = mockD1Database;
  });

  describe("GET /list", () => {
    it("should return list of central alerts", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/list",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: CentralAlertsResponse = await response.json();

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error", null);
      expect(data.result).toHaveProperty("alerts");
      expect(Array.isArray(data.result.alerts)).toBe(true);
    });

    it("should return alerts from static data", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/list",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      const data: CentralAlertsResponse = await response.json();
      const alerts = data.result.alerts;

      const sqlAlert = alerts.find((alert: { id: string }) => alert.id === "1");
      expect(sqlAlert).toBeTruthy();
      expect(sqlAlert!.type).toBe("danger");
      expect(sqlAlert!.message).toContain("SQL injection");
      expect(sqlAlert!.max_fossbilling_version).toBe("0.5.2");
    });

    it("should include buttons in alerts when present", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/list",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      const data: CentralAlertsResponse = await response.json();
      const alerts = data.result.alerts;

      const sqlAlert = alerts.find((alert: { id: string }) => alert.id === "1");
      expect(sqlAlert!.buttons).toBeTruthy();
      expect(Array.isArray(sqlAlert!.buttons)).toBe(true);
      expect(sqlAlert!.buttons!.length).toBeGreaterThan(0);

      sqlAlert!.buttons!.forEach((button: { text: string; link: string }) => {
        expect(button).toHaveProperty("text");
        expect(button).toHaveProperty("link");
        expect(button.link).toMatch(/^https?:\/\//);
      });
    });

    it("should redirect trailing slash to non-trailing slash path", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/list/",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(301);
      const location = response.headers.get("Location");
      expect(location).toContain("/central-alerts/v1/list");
      expect(location).not.toContain("/central-alerts/v1/list/");
    });

    it("should return consistent data on multiple requests", async () => {
      const ctx1 = createExecutionContext();
      const response1 = await app.request(
        "/central-alerts/v1/list",
        {},
        env,
        ctx1
      );
      await waitOnExecutionContext(ctx1);
      const data1 = await response1.json();

      const ctx2 = createExecutionContext();
      const response2 = await app.request(
        "/central-alerts/v1/list",
        {},
        env,
        ctx2
      );
      await waitOnExecutionContext(ctx2);
      const data2 = await response2.json();

      expect(data1).toEqual(data2);
    });

    it("should return valid ISO 8601 datetime", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/list",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      const data: CentralAlertsResponse = await response.json();
      const alerts = data.result.alerts;

      alerts.forEach((alert: { datetime: string }) => {
        const date = new Date(alert.datetime);
        expect(date.toString()).not.toBe("Invalid Date");
        expect(alert.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });
  });

  describe("GET /version/:version", () => {
    it("should return alerts for specific version", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/version/0.5.0",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: CentralAlertsResponse = await response.json();

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error", null);
      expect(data.result).toHaveProperty("alerts");
      expect(Array.isArray(data.result.alerts)).toBe(true);
    });

    it("should filter alerts based on version range", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/version/0.5.0",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      const data: CentralAlertsResponse = await response.json();
      const alerts = data.result.alerts;

      alerts.forEach((alert: { min_fossbilling_version: string; max_fossbilling_version: string }) => {
        const isInRange =
          "0.5.0" >= alert.min_fossbilling_version &&
          "0.5.0" <= alert.max_fossbilling_version;
        const isUniversal =
          alert.min_fossbilling_version === "0.0.0" &&
          alert.max_fossbilling_version === "9999.9999.9999";
        expect(isInRange || isUniversal).toBe(true);
      });
    });

    it("should return empty array for version with no alerts", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/version/99.99.99",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: CentralAlertsResponse = await response.json();
      expect(data.result.alerts).toHaveLength(0);
    });
  });

  describe("GET /:id", () => {
    it("should return specific alert by ID", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/1",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        result: { alert: { id: string } };
        error: null;
      };

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error", null);
      expect(data.result).toHaveProperty("alert");
      expect(data.result.alert.id).toBe("1");
    });

    it("should return 404 for non-existent alert ID", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/999",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = (await response.json()) as {
        result: null;
        error: { message: string };
      };

      expect(data.result).toBe(null);
      expect(data.error).toBeTruthy();
      expect(data.error.message).toContain("not found");
    });
  });

  describe("POST /", () => {
    it("should create new alert with valid data", async () => {
      const newAlert = {
        title: "Test Alert",
        message: "This is a test alert message",
        type: "warning",
        dismissible: true,
        min_fossbilling_version: "0.1.0",
        max_fossbilling_version: "0.9.0",
        include_preview_branch: false,
        datetime: "2023-01-01T00:00:00Z"
      };

      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(newAlert)
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(201);
      const data = (await response.json()) as {
        result: { alert: { title: string; type: string } };
        error: null;
      };

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error", null);
      expect(data.result).toHaveProperty("alert");
      expect(data.result.alert.title).toBe("Test Alert");
      expect(data.result.alert.type).toBe("warning");
    });

    it("should return 400 when missing required fields", async () => {
      const incompleteAlert = {
        title: "Incomplete Alert"
      };

      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(incompleteAlert)
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = (await response.json()) as {
        result: null;
        error: { message: string; code: string };
      };

      expect(data.result).toBe(null);
      expect(data.error).toBeTruthy();
      expect(data.error.message).toContain("Missing required field");
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("should create alert with optional buttons", async () => {
      const alertWithButtons = {
        title: "Alert with Buttons",
        message: "This alert has buttons",
        type: "info",
        dismissible: true,
        min_fossbilling_version: "0.1.0",
        max_fossbilling_version: "0.9.0",
        include_preview_branch: false,
        datetime: "2023-01-01T00:00:00Z",
        buttons: [
          { text: "Learn More", link: "https://example.com" }
        ]
      };

      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(alertWithButtons)
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(201);
      const data = (await response.json()) as {
        result: { alert: { buttons?: unknown[] } };
        error: null;
      };

      expect(data.result.alert.buttons).toBeTruthy();
      expect(Array.isArray(data.result.alert.buttons)).toBe(true);
    });
  });

  describe("PUT /:id", () => {
    it("should update existing alert", async () => {
      const updateData = {
        title: "Updated Alert Title",
        type: "danger"
      };

      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/1",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updateData)
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        result: { alert: { title: string; type: string } };
        error: null;
      };

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error", null);
      expect(data.result).toHaveProperty("alert");
      expect(data.result.alert.title).toBe("Updated Alert Title");
      expect(data.result.alert.type).toBe("danger");
    });

    it("should return 404 when updating non-existent alert", async () => {
      const updateData = {
        title: "Updated Title"
      };

      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/999",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updateData)
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = (await response.json()) as {
        result: null;
        error: { message: string };
      };

      expect(data.result).toBe(null);
      expect(data.error).toBeTruthy();
      expect(data.error.message).toContain("not found");
    });

    it("should allow partial updates", async () => {
      const updateData = {
        dismissible: true
      };

      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/1",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(updateData)
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        result: { alert: { dismissible: boolean } };
        error: null;
      };

      expect(data.result.alert.dismissible).toBe(true);
    });
  });

  describe("DELETE /:id", () => {
    it("should delete existing alert", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/1",
        {
          method: "DELETE"
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        result: { success: boolean };
        error: null;
      };

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error", null);
      expect(data.result).toHaveProperty("success", true);
    });

    it("should return 404 when deleting non-existent alert", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/999",
        {
          method: "DELETE"
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = (await response.json()) as {
        result: null;
        error: { message: string };
      };

      expect(data.result).toBe(null);
      expect(data.error).toBeTruthy();
      expect(data.error.message).toContain("not found");
    });
  });

  describe("Error Cases", () => {
    it("should return 404 for unknown routes", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/central-alerts/v1/unknown",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });

    it("should redirect root path with trailing slash", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/central-alerts/v1/", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(301);
      const location = response.headers.get("Location");
      expect(location).toContain("/central-alerts/v1");
      expect(location).not.toContain("/central-alerts/v1/");
    });
  });
});
