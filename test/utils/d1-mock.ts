/**
 * Mock D1 Database for testing
 * Implements the D1Database interface with in-memory storage
 */
import { CentralAlert } from "../../src/central-alerts/v1/interfaces";

type DatabaseAlert = Omit<CentralAlert, "buttons"> & {
  created_at: string;
  updated_at: string;
  buttons?: string; // JSON string in database
};

export class MockD1Database implements D1Database {
  private alerts: DatabaseAlert[] = [];

  constructor() {
    // Initialize with test data
    this.alerts = [
      {
        id: "1",
        title: "SQL Injection Vulnerability",
        message:
          "A critical SQL injection vulnerability has been discovered. Please update immediately.",
        type: "danger",
        dismissible: false,
        min_fossbilling_version: "0.0.0",
        max_fossbilling_version: "0.5.2",
        include_preview_branch: false,
        buttons:
          '[{"text":"Security Advisory","link":"https://fossbilling.org/security-advisory","type":"danger"}]',
        datetime: "2023-01-15T10:30:00Z",
        created_at: "2023-01-15T10:30:00Z",
        updated_at: "2023-01-15T10:30:00Z"
      }
    ];
  }

  prepare(query: string): D1PreparedStatement {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const mockDb = this;

    return {
      bind(...params: unknown[]) {
        return {
          async all(): Promise<D1Result<DatabaseAlert>> {
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
                  version >= alert.min_fossbilling_version &&
                  version <= alert.max_fossbilling_version
                );
              });
              return {
                success: true,
                results: filteredAlerts,
                meta: {
                  duration: 0,
                  last_row_id: 0,
                  changes: 0,
                  served_by: "mock",
                  size_after: 0,
                  rows_read: 0,
                  rows_written: 0,
                  changed_db: false
                }
              };
            }

            // Simulate getting alert by ID
            if (query.includes("WHERE id = ?")) {
              const id = params[0];
              const alert = mockDb.alerts.find((a) => a.id === id);
              return {
                success: true,
                results: alert ? [alert] : [],
                meta: {
                  duration: 0,
                  last_row_id: 0,
                  changes: 0,
                  served_by: "mock",
                  size_after: 0,
                  rows_read: 0,
                  rows_written: 0,
                  changed_db: false
                }
              };
            }

            return {
              success: true,
              results: [],
              meta: {
                duration: 0,
                last_row_id: 0,
                changes: 0,
                served_by: "mock",
                size_after: 0,
                rows_read: 0,
                rows_written: 0,
                changed_db: false
              }
            };
          },

          async first<T = Record<string, unknown>>(): Promise<T | null> {
            // Simulate getting first result (for getAlertById)
            if (query.includes("WHERE id = ?")) {
              const id = params[0] as string;
              const alert = mockDb.alerts.find((a) => a.id === id);
              return (alert as T | undefined) || null;
            }

            return null;
          },

          async run(): Promise<D1Response> {
            // Simulate INSERT operations
            if (query.includes("INSERT INTO central_alerts")) {
              const newAlert: DatabaseAlert = {
                id: params[0] as string,
                title: params[1] as string,
                message: params[2] as string,
                type: params[3] as "info" | "warning" | "danger" | "success",
                dismissible: params[4] as boolean,
                min_fossbilling_version: params[5] as string,
                max_fossbilling_version: params[6] as string,
                include_preview_branch: params[7] as boolean,
                datetime: params[8] as string,
                buttons: params[9] as string,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              mockDb.alerts.push(newAlert);
              return {
                success: true,
                meta: {
                  duration: 0,
                  last_row_id: mockDb.alerts.length,
                  changes: 1,
                  served_by: "mock",
                  size_after: 0,
                  rows_read: 0,
                  rows_written: 1,
                  changed_db: true
                }
              };
            }

            // Simulate UPDATE operations
            if (query.includes("UPDATE central_alerts")) {
              const id = params[params.length - 1] as string;
              const alertIndex = mockDb.alerts.findIndex((a) => a.id === id);

              if (alertIndex === -1) {
                return {
                  success: true,
                  meta: {
                    duration: 0,
                    last_row_id: 0,
                    changes: 0,
                    served_by: "mock",
                    size_after: 0,
                    rows_read: 0,
                    rows_written: 0,
                    changed_db: true
                  }
                };
              }

              const alert = { ...mockDb.alerts[alertIndex] };
              let paramIndex = 0;

              // Parse fields from query and params
              if (query.includes("title = ?")) {
                alert.title = params[paramIndex++] as string;
              }
              if (query.includes("message = ?")) {
                alert.message = params[paramIndex++] as string;
              }
              if (query.includes("type = ?")) {
                alert.type = params[paramIndex++] as
                  | "info"
                  | "warning"
                  | "danger"
                  | "success";
              }
              if (query.includes("dismissible = ?")) {
                alert.dismissible = params[paramIndex++] as boolean;
              }
              if (query.includes("min_fossbilling_version = ?")) {
                alert.min_fossbilling_version = params[paramIndex++] as string;
              }
              if (query.includes("max_fossbilling_version = ?")) {
                alert.max_fossbilling_version = params[paramIndex++] as string;
              }
              if (query.includes("include_preview_branch = ?")) {
                alert.include_preview_branch = params[paramIndex++] as boolean;
              }
              if (query.includes("datetime = ?")) {
                alert.datetime = params[paramIndex++] as string;
              }
              if (query.includes("buttons = ?")) {
                alert.buttons = params[paramIndex++] as string;
              }

              alert.updated_at = new Date().toISOString();
              mockDb.alerts[alertIndex] = alert;

              return {
                success: true,
                meta: {
                  duration: 0,
                  last_row_id: 0,
                  changes: 1,
                  served_by: "mock",
                  size_after: 0,
                  rows_read: 1,
                  rows_written: 1,
                  changed_db: true
                }
              };
            }

            // Simulate DELETE operations
            if (query.includes("DELETE FROM central_alerts")) {
              const id = params[0] as string;
              const initialLength = mockDb.alerts.length;
              mockDb.alerts = mockDb.alerts.filter((a) => a.id !== id);
              const wasDeleted = mockDb.alerts.length < initialLength;

              return {
                success: true,
                meta: {
                  duration: 0,
                  last_row_id: 0,
                  changes: wasDeleted ? 1 : 0,
                  served_by: "mock",
                  size_after: 0,
                  rows_read: 1,
                  rows_written: wasDeleted ? 1 : 0,
                  changed_db: true
                }
              };
            }

            return {
              success: true,
              meta: {
                duration: 0,
                last_row_id: 0,
                changes: 0,
                served_by: "mock",
                size_after: 0,
                rows_read: 0,
                rows_written: 0,
                changed_db: false
              }
            };
          }
        };
      },

      async all(): Promise<D1Result<DatabaseAlert>> {
        // Simulate getting all alerts
        if (
          query.includes("FROM central_alerts") &&
          (query.includes("ORDER BY datetime DESC") ||
            query.includes('ORDER BY "datetime" DESC'))
        ) {
          return {
            success: true,
            results: mockDb.alerts,
            meta: {
              duration: 0,
              last_row_id: 0,
              changes: 0,
              served_by: "mock",
              size_after: 0,
              rows_read: 0,
              rows_written: 0,
              changed_db: false
            }
          };
        }

        return {
          success: true,
          results: [],
          meta: {
            duration: 0,
            last_row_id: 0,
            changes: 0,
            served_by: "mock",
            size_after: 0,
            rows_read: 0,
            rows_written: 0,
            changed_db: false
          }
        };
      },

      async first<T = Record<string, unknown>>(): Promise<T | null> {
        // Simulate getting first result (for getAlertById without bind)
        if (query.includes("WHERE id = ?")) {
          // This shouldn't be called without bind, but handle it
          return null;
        }

        return null;
      }
    } as D1PreparedStatement;
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error("dump() not implemented in mock");
  }

  batch<T = unknown>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]> {
    throw new Error("batch() not implemented in mock");
  }

  exec(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _query: string
  ): Promise<D1ExecResult> {
    throw new Error("exec() not implemented in mock");
  }

  withSession(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _constraintOrBookmark?: string
  ): D1DatabaseSession {
    throw new Error("withSession() not implemented in mock");
  }
}

// Create a singleton instance
export const mockD1Database = new MockD1Database();
