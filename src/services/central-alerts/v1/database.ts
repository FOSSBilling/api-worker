import { CentralAlert } from "./interfaces";
import { DatabaseResult, IDatabase } from "../../../lib/interfaces";

export class CentralAlertsDatabase {
  private db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  async getAllAlerts(): Promise<DatabaseResult<CentralAlert[]>> {
    const query = `
      SELECT 
        id,
        title,
        message,
        type,
        dismissible,
        min_fossbilling_version,
        max_fossbilling_version,
        include_preview_branch,
        buttons,
        "datetime"
      FROM central_alerts
      ORDER BY "datetime" DESC
    `;

    let result;
    try {
      result = await this.db.prepare(query).all<Record<string, unknown>>();
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: "DATABASE_ERROR"
        }
      };
    }

    if (!result.success) {
      return {
        data: null,
        error: {
          message: result.error || "Database query failed",
          code: "DATABASE_ERROR"
        }
      };
    }

    const alerts = (result.results ?? []).map((alert) => {
      const alertData = alert as Record<string, unknown>;
      return {
        ...alertData,
        dismissible: Boolean(alertData.dismissible),
        include_preview_branch: Boolean(alertData.include_preview_branch),
        buttons: parseButtons(alertData.buttons)
      };
    }) as CentralAlert[];

    return { data: alerts, error: null };
  }
}

function parseButtons(value: unknown): CentralAlert["buttons"] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value as CentralAlert["buttons"];
  }

  return [];
}
