import { CentralAlert } from "./interfaces";

export interface CentralAlertWithButtons extends CentralAlert {
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseError {
  message: string;
  code?: string;
}

export class CentralAlertsDatabase {
  private db: D1Database;

  constructor(db: D1Database) {
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
        created_at,
        updated_at
      FROM central_alerts
      ORDER BY datetime DESC
    `;

    const result = await this.db.prepare(query).all();

    const alerts = result.results?.map((alert) => ({
      ...alert,
      buttons:
        typeof alert.buttons === "string"
          ? JSON.parse(alert.buttons)
          : alert.buttons || []
    })) as CentralAlertWithButtons[];

    return { data: alerts, error: null };
  }

  async getAlertsByVersion(version: string): Promise<{
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
        created_at,
        updated_at
      FROM central_alerts
      WHERE 
        (min_fossbilling_version <= ? AND max_fossbilling_version >= ?)
        OR (min_fossbilling_version = '0.0.0' AND max_fossbilling_version = '9999.9999.9999')
      ORDER BY datetime DESC
    `;

    const result = await this.db.prepare(query).bind(version, version).all();

    const alerts = result.results?.map((alert) => ({
      ...alert,
      buttons:
        typeof alert.buttons === "string"
          ? JSON.parse(alert.buttons)
          : alert.buttons || []
    })) as CentralAlertWithButtons[];

    return { data: alerts, error: null };
  }

  async createAlert(
    alert: Omit<CentralAlert, "id"> & { id?: string }
  ): Promise<{
    data: CentralAlertWithButtons | null;
    error: DatabaseError | null;
  }> {
    const alertId = alert.id || this.generateId();
    const buttonsJson = JSON.stringify(alert.buttons || []);

    const alertResult = await this.db
      .prepare(
        `
        INSERT INTO central_alerts (
          id, title, message, type, dismissible, 
          min_fossbilling_version, max_fossbilling_version, 
          include_preview_branch, datetime, buttons
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        alertId,
        alert.title,
        alert.message,
        alert.type,
        alert.dismissible,
        alert.min_fossbilling_version,
        alert.max_fossbilling_version,
        alert.include_preview_branch,
        alert.datetime,
        buttonsJson
      )
      .run();

    if (!alertResult.success) {
      return { data: null, error: { message: "Failed to create alert" } };
    }

    return await this.getAlertById(alertId);
  }

  async getAlertById(id: string): Promise<{
    data: CentralAlertWithButtons | null;
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
        created_at,
        updated_at
      FROM central_alerts
      WHERE id = ?
    `;

    const result = await this.db.prepare(query).bind(id).first();

    if (!result) {
      return { data: null, error: { message: "Alert not found" } };
    }

    const alert = {
      ...result,
      buttons:
        typeof result.buttons === "string"
          ? JSON.parse(result.buttons)
          : result.buttons || []
    } as CentralAlertWithButtons;

    return { data: alert, error: null };
  }

  async updateAlert(
    id: string,
    alert: Partial<CentralAlert>
  ): Promise<{
    data: CentralAlertWithButtons | null;
    error: DatabaseError | null;
  }> {
    const fields = [];
    const values = [];

    if (alert.title !== undefined) {
      fields.push("title = ?");
      values.push(alert.title);
    }
    if (alert.message !== undefined) {
      fields.push("message = ?");
      values.push(alert.message);
    }
    if (alert.type !== undefined) {
      fields.push("type = ?");
      values.push(alert.type);
    }
    if (alert.dismissible !== undefined) {
      fields.push("dismissible = ?");
      values.push(alert.dismissible);
    }
    if (alert.min_fossbilling_version !== undefined) {
      fields.push("min_fossbilling_version = ?");
      values.push(alert.min_fossbilling_version);
    }
    if (alert.max_fossbilling_version !== undefined) {
      fields.push("max_fossbilling_version = ?");
      values.push(alert.max_fossbilling_version);
    }
    if (alert.include_preview_branch !== undefined) {
      fields.push("include_preview_branch = ?");
      values.push(alert.include_preview_branch);
    }
    if (alert.datetime !== undefined) {
      fields.push("datetime = ?");
      values.push(alert.datetime);
    }
    if (alert.buttons !== undefined) {
      fields.push("buttons = ?");
      values.push(JSON.stringify(alert.buttons));
    }

    if (fields.length === 0) {
      return { data: null, error: { message: "No fields to update" } };
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const updateQuery = `UPDATE central_alerts SET ${fields.join(", ")} WHERE id = ?`;
    const updateResult = await this.db
      .prepare(updateQuery)
      .bind(...values)
      .run();

    if (!updateResult.success) {
      return { data: null, error: { message: "Alert not found" } };
    }

    return await this.getAlertById(id);
  }

  async deleteAlert(
    id: string
  ): Promise<{ success: boolean; error: DatabaseError | null }> {
    const result = await this.db
      .prepare("DELETE FROM central_alerts WHERE id = ?")
      .bind(id)
      .run();

    if (!result.success) {
      return { success: false, error: { message: "Alert not found" } };
    }

    return { success: true, error: null };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
