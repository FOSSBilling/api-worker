#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runWranglerCommand(command: string): string {
  return execSync(command, { encoding: "utf8", stdio: "pipe" });
}

async function initializeDatabase(): Promise<void> {
  console.log("Initializing Central Alerts Database...");

  const initSQLPath = join(__dirname, "..", "db", "init.sql");
  const initSQL = readFileSync(initSQLPath, "utf8");

  const statements = initSQL
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"))
    .map((stmt) => stmt + ";");

  for (const statement of statements) {
    const command = `echo "${statement.replace(/"/g, '\\"')}" | npx wrangler d1 execute api-worker_central-alerts --local`;
    runWranglerCommand(command);
  }

  console.log("Database initialization completed successfully!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().catch((error) => {
    console.error(
      `Database initialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}

export { initializeDatabase };
