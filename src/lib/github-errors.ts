export enum ErrorPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
    public readonly errorCode?: string,
    public readonly priority: ErrorPriority = ErrorPriority.MEDIUM,
    public readonly url?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthError extends GitHubError {
  constructor(message: string, httpStatus: number = 401, url?: string) {
    super(message, httpStatus, "auth_error", ErrorPriority.CRITICAL, url);
  }
}

export class RateLimitError extends GitHubError {
  constructor(message: string, httpStatus: number = 403, url?: string) {
    super(message, httpStatus, "rate_limit_error", ErrorPriority.CRITICAL, url);
  }
}

export class NetworkError extends GitHubError {
  constructor(message: string, url?: string) {
    super(message, undefined, "network_error", ErrorPriority.HIGH, url);
  }
}

export class NotFoundError extends GitHubError {
  constructor(message: string, httpStatus: number = 404, url?: string) {
    super(message, httpStatus, "not_found_error", ErrorPriority.MEDIUM, url);
  }
}

export class ValidationError extends GitHubError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      undefined,
      "validation_error",
      ErrorPriority.LOW,
      undefined,
      details
    );
  }
}

export function classifyGitHubError(error: unknown, url?: string): GitHubError {
  if (error instanceof GitHubError) {
    return error;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    if (
      typeof err.status === "number" &&
      err.status === 401 &&
      typeof err.message === "string"
    ) {
      return new AuthError(err.message, err.status, url);
    }

    if (
      typeof err.status === "number" &&
      err.status === 403 &&
      typeof err.message === "string"
    ) {
      const message = errorMessage.toLowerCase().includes("rate limit")
        ? "GitHub API rate limit exceeded"
        : err.message;
      return new RateLimitError(message, err.status, url);
    }

    if (
      typeof err.status === "number" &&
      err.status === 404 &&
      typeof err.message === "string"
    ) {
      return new NotFoundError(err.message, err.status, url);
    }
  }

  if (errorMessage.toLowerCase().includes("timeout")) {
    return new NetworkError("GitHub API request timed out", url);
  }

  if (errorMessage.toLowerCase().includes("network")) {
    return new NetworkError("GitHub API network error", url);
  }

  if (errorMessage.toLowerCase().includes("json")) {
    return new ValidationError("Invalid JSON response from GitHub API", {
      originalMessage: errorMessage
    });
  }

  return new GitHubError(
    errorMessage,
    undefined,
    "unknown_error",
    ErrorPriority.HIGH,
    url
  );
}

export function getMostCriticalError(
  errors: GitHubError[]
): GitHubError | null {
  if (errors.length === 0) {
    return null;
  }

  return errors.reduce((mostCritical, current) =>
    current.priority < mostCritical.priority ? current : mostCritical
  );
}
