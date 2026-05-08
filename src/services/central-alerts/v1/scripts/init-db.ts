#!/usr/bin/env node

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runWranglerCommand(args: string[]): void {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "api_central-alerts", "--local", ...args],
    {
      encoding: "utf8",
      stdio: "pipe"
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Wrangler command failed: npx ${["wrangler", "d1", "execute", "api_central-alerts", "--local", ...args].join(" ")}`,
        result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : "",
        result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}

async function initializeDatabase(): Promise<void> {
  console.log("Initializing Central Alerts Database...");

  const initSQLPath = join(__dirname, "..", "db", "init.sql");
  try {
    runWranglerCommand(["--file", initSQLPath]);
  } catch (error) {
    console.error(`Failed SQL file: ${initSQLPath}`);
    throw error;
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
