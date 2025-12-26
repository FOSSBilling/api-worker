export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info"
}

interface LogEntry {
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function redactSensitiveData(data: unknown): unknown {
  if (typeof data === "string") {
    return data.replace(/Bearer\s+[A-Za-z0-9\-_]+/g, "Bearer [REDACTED]");
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (data && typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("password")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveData(value);
      }
    }
    return result;
  }

  return data;
}

function log(
  level: LogLevel,
  service: string,
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    service,
    level,
    message,
    context: context
      ? (redactSensitiveData(context) as Record<string, unknown>)
      : undefined
  };

  const logMessage = `[${entry.timestamp}] [${service.toUpperCase()}] [${level.toUpperCase()}] ${message}`;
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

  switch (level) {
    case LogLevel.ERROR:
      console.error(logMessage + contextStr);
      break;
    case LogLevel.WARN:
      console.warn(logMessage + contextStr);
      break;
    case LogLevel.INFO:
      console.info(logMessage + contextStr);
      break;
  }
}

export function logError(
  service: string,
  message: string,
  context?: Record<string, unknown>
): void {
  log(LogLevel.ERROR, service, message, context);
}

export function logWarn(
  service: string,
  message: string,
  context?: Record<string, unknown>
): void {
  log(LogLevel.WARN, service, message, context);
}

export function logInfo(
  service: string,
  message: string,
  context?: Record<string, unknown>
): void {
  log(LogLevel.INFO, service, message, context);
}
