import { CentralAlert } from "./interfaces";
import { IDatabase } from "../../platform/interfaces";

export interface CentralAlertWithButtons extends CentralAlert {
  updated_at?: string;
}

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
    data: CentralAlertWithButtons[] | null;
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
        datetime,
        updated_at
      FROM central_alerts
      ORDER BY datetime DESC
    `;

    const result = await this.db.prepare(query).all<Record<string, unknown>>();

    const alerts = result.results?.map((alert) => {
      const alertData = alert as Record<string, unknown>;
      return {
        ...alertData,
        buttons:
          typeof alertData.buttons === "string"
            ? JSON.parse(alertData.buttons)
            : (alertData.buttons as unknown[]) || []
      };
    }) as CentralAlertWithButtons[];

    return { data: alerts, error: null };
  }
}
