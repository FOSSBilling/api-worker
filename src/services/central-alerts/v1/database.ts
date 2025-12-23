import { CentralAlert } from "./interfaces";
import { IDatabase } from "../../../lib/interfaces";

export interface DatabaseError {
  message: string;
  code?: string;
}

export class CentralAlertsDatabase {
  private db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  async getAllAlerts(): Promise<{
    data: CentralAlert[] | null;
    error: DatabaseError | null;
  }> {
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

    const result = await this.db.prepare(query).all<Record<string, unknown>>();

    const alerts = result.results?.map((alert) => {
      const alertData = alert as Record<string, unknown>;
      return {
        ...alertData,
        dismissible: Boolean(alertData.dismissible),
        include_preview_branch: Boolean(alertData.include_preview_branch),
        buttons:
          typeof alertData.buttons === "string"
            ? JSON.parse(alertData.buttons)
            : (alertData.buttons as unknown[]) || []
      };
    }) as CentralAlert[];

    return { data: alerts, error: null };
  }
}
