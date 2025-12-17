import { describe, it, expect, beforeAll } from "vitest";
import { CentralAlertsDatabase } from "../../../src/central-alerts/v1/database";

// Mock D1 Database for testing
class MockD1Database {
  private alerts: Record<string, unknown>[] = [];
  private buttons: Record<string, unknown>[] = [];

  constructor() {
    // Initialize with test data using JSON buttons approach
    this.alerts = [
      {
        id: "1",
        title: "Test Alert",
        message: "This is a test alert",
        type: "info",
        dismissible: false,
        min_fossbilling_version: "0.0.0",
        max_fossbilling_version: "1.0.0",
        include_preview_branch: false,
        buttons:
          '[{"text":"Test Button","link":"https://example.com","type":"info"}]',
        datetime: "2023-01-01T00:00:00Z",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z"
      }
    ];
  }

  prepare(query: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const mockDb = this;
    const result = {
      bind(...params: unknown[]) {
        return {
          all() {
            // Simulate getting all alerts (no WHERE clause)
            if (
              query.includes("FROM central_alerts") &&
              (query.includes("ORDER BY datetime DESC") ||
                query.includes('ORDER BY "datetime" DESC')) &&
              !query.includes("WHERE")
            ) {
              return { success: true, results: mockDb.alerts };
            }

            // Simulate getting alerts by version
            if (
              query.includes("min_fossbilling_version") &&
              query.includes("max_fossbilling_version")
            ) {
              const version = params[0] as string;
              const filteredAlerts = mockDb.alerts.filter((alert) => {
                // Check if it's the universal alert (applies to all versions)
                if (
                  alert.min_fossbilling_version === "0.0.0" &&
                  alert.max_fossbilling_version === "9999.9999.9999"
                ) {
                  return true;
                }
                // For version comparison, we need to check if version is within the alert's range
                return (
                  version >= (alert.min_fossbilling_version as string) &&
                  version <= (alert.max_fossbilling_version as string)
                );
              });

              return { success: true, results: filteredAlerts };
            }

            return { success: true, results: [] };
          },

          first() {
            // Simulate getting a specific alert by ID
            if (query.includes("WHERE id = ?")) {
              const id = params[0] as string;
              return mockDb.alerts.find((a) => a.id === id) || null;
            }

            return null;
          },

          run() {
            // Simulate INSERT operations for alerts
            if (query.includes("INSERT INTO central_alerts")) {
              const newAlert = {
                id: params[0],
                title: params[1],
                message: params[2],
                type: params[3],
                dismissible: params[4],
                min_fossbilling_version: params[5],
                max_fossbilling_version: params[6],
                include_preview_branch: params[7],
                datetime: params[8],
                buttons: params[9] || "[]",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              mockDb.alerts.push(newAlert);
              return {
                success: true,
                meta: {
                  changes: 1
                }
              };
            }

            // Simulate UPDATE operations
            if (query.includes("UPDATE central_alerts")) {
              const id = params[params.length - 1] as string;
              const alertIndex = mockDb.alerts.findIndex((a) => a.id === id);

              if (alertIndex !== -1) {
                // Update fields based on the query
                const alert = mockDb.alerts[alertIndex];

                // Parse the update fields from the query
                const updatedAlert = { ...alert };

                if (query.includes("title = ?")) {
                  const titleIndex = params.findIndex(
                    (p, i) => i < params.length - 1 && p !== id
                  );
                  if (titleIndex !== -1) {
                    updatedAlert.title = params[titleIndex];
                  }
                }

                if (query.includes("type = ?")) {
                  const typeIndex = params.findIndex(
                    (p, i) =>
                      i < params.length - 1 &&
                      p !== id &&
                      p !== updatedAlert.title
                  );
                  if (typeIndex !== -1) {
                    updatedAlert.type = params[typeIndex];
                  }
                }

                updatedAlert.updated_at = new Date().toISOString();
                mockDb.alerts[alertIndex] = updatedAlert;
                return {
                  success: true,
                  meta: {
                    changes: 1
                  }
                };
              }

              return {
                success: true,
                meta: {
                  changes: 0
                }
              };
            }

            // Simulate DELETE operations
            if (query.includes("DELETE FROM central_alerts")) {
              const id = params[0] as string;
              const initialLength = mockDb.alerts.length;
              mockDb.alerts = mockDb.alerts.filter((a) => a.id !== id);

              const changes = initialLength - mockDb.alerts.length;
              return {
                success: true,
                meta: {
                  changes
                }
              };
            }

            // Simulate DELETE operations for buttons
            if (query.includes("DELETE FROM central_alert_buttons")) {
              const alertId = params[0] as string;
              const initialLength = mockDb.buttons.length;
              mockDb.buttons = mockDb.buttons.filter(
                (b) => b.alert_id !== alertId
              );

              return {
                success: true,
                meta: {
                  changes: initialLength - mockDb.buttons.length
                }
              };
            }

            return {
              success: true,
              meta: {
                changes: 0
              }
            };
          }
        };
      },
      // Also support all() directly on prepare result (no bind)
      all() {
        // Simulate getting all alerts
        if (
          query.includes("FROM central_alerts") &&
          (query.includes("ORDER BY datetime DESC") ||
            query.includes('ORDER BY "datetime" DESC'))
        ) {
          return { success: true, results: mockDb.alerts };
        }

        // Simulate getting alerts by version
        if (
          query.includes("WHERE") &&
          query.includes("min_fossbilling_version") &&
          query.includes("max_fossbilling_version")
        ) {
          const version = "0.5.0"; // Default for direct call
          const filteredAlerts = mockDb.alerts.filter((alert) => {
            return (
              (alert.min_fossbilling_version === "0.0.0" &&
                alert.max_fossbilling_version === "9999.9999.9999") ||
              (version >= (alert.min_fossbilling_version as string) &&
                version <= (alert.max_fossbilling_version as string))
            );
          });

          return { success: true, results: filteredAlerts };
        }

        return { success: true, results: [] };
      }
    };

    return result;
  }

  batch(statements: unknown[]) {
    return Promise.all(
      statements.map((stmt) => {
        if (stmt && typeof stmt === "object" && "bind" in stmt) {
          return (stmt as D1PreparedStatement).bind().run();
        }
        return (stmt as D1PreparedStatement).run();
      })
    );
  }
}

describe("CentralAlertsDatabase", () => {
  let db: CentralAlertsDatabase;
  let mockD1: MockD1Database;

  beforeAll(() => {
    mockD1 = new MockD1Database();
    // @ts-expect-error - We're mocking the D1 database
    db = new CentralAlertsDatabase(mockD1);
  });

  describe("getAllAlerts", () => {
    it("should return all alerts with buttons", async () => {
      const { data, error } = await db.getAllAlerts();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].id).toBe("1");
      expect(data?.[0].title).toBe("Test Alert");
      expect(data?.[0].buttons).toHaveLength(1);
      expect(data?.[0].buttons?.[0].text).toBe("Test Button");
    });
  });
});
