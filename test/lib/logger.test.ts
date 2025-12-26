import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logError, logWarn, logInfo } from "../../src/lib/logger";

describe("Logger", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  describe("logError", () => {
    it("should log error message to console.error", () => {
      logError("TEST_SERVICE", "Error occurred");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TEST_SERVICE]")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error occurred")
      );
    });

    it("should log with context", () => {
      const context = { userId: 123, action: "test" };
      logError("TEST_SERVICE", "Error occurred", context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(context))
      );
    });

    it("should redact Bearer tokens in context", () => {
      const context = { authorization: "Bearer secret-token-12345" };
      logError("TEST_SERVICE", "Error occurred", context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Bearer [REDACTED]")
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret-token-12345")
      );
    });

    it("should include timestamp in log", () => {
      logError("TEST_SERVICE", "Error occurred");

      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logCall).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/
      );
    });
  });

  describe("logWarn", () => {
    it("should log warning message to console.warn", () => {
      logWarn("TEST_SERVICE", "Warning message");

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TEST_SERVICE]")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]")
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning message")
      );
    });

    it("should not call other console methods", () => {
      logWarn("TEST_SERVICE", "Warning message");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe("logInfo", () => {
    it("should log info message to console.info", () => {
      logInfo("TEST_SERVICE", "Info message");

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TEST_SERVICE]")
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO]")
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Info message")
      );
    });

    it("should not call other console methods", () => {
      logInfo("TEST_SERVICE", "Info message");

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("Data Redaction", () => {
    it("should redact 'token' keys in context", () => {
      const context = { api_token: "secret", other: "value" };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"api_token":"[REDACTED]"')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"other":"value"')
      );
    });

    it("should redact 'key' keys in context", () => {
      const context = { secret_key: "secret", public_key: "public" };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"secret_key":"[REDACTED]"')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"public_key":"[REDACTED]"')
      );
    });

    it("should redact 'secret' keys in context", () => {
      const context = { my_secret: "secret", visible: "value" };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"my_secret":"[REDACTED]"')
      );
    });

    it("should redact 'password' keys in context", () => {
      const context = { password: "secret123", username: "user" };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"password":"[REDACTED]"')
      );
    });

    it("should redact keys case-insensitively", () => {
      const context = {
        API_KEY: "secret",
        SecretKey: "secret2",
        PASSWORD: "secret3"
      };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret")
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("[REDACTED]")
      );
    });

    it("should redact nested sensitive data", () => {
      const context = {
        user: { password: "secret123", name: "John" },
        config: { api_key: "key456" }
      };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret123")
      );
      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("key456")
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name":"John"')
      );
    });

    it("should redact sensitive data in arrays", () => {
      const context = {
        items: [{ token: "secret1" }, { token: "secret2" }, { name: "safe" }]
      };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret1")
      );
      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("secret2")
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name":"safe"')
      );
    });

    it("should handle strings directly with Bearer tokens", () => {
      const context = { auth: "Bearer abc123def456" };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Bearer [REDACTED]")
      );
      expect(consoleInfoSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("abc123def456")
      );
    });

    it("should handle nested strings with Bearer tokens", () => {
      const context = { headers: { authorization: "Bearer token123" } };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("Bearer [REDACTED]")
      );
    });

    it("should preserve non-sensitive data", () => {
      const context = {
        user_id: 123,
        name: "Test User",
        action: "login",
        timestamp: "2023-01-01"
      };
      logInfo("TEST_SERVICE", "Message", context);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"user_id":123')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('"name":"Test User"')
      );
    });
  });

  describe("Log Format", () => {
    it("should format log with timestamp, service, level, and message", () => {
      logInfo("MY_SERVICE", "Test message");

      const logCall = consoleInfoSpy.mock.calls[0][0] as string;
      expect(logCall).toMatch(
        /^\[[^\]]+\] \[MY_SERVICE\] \[INFO\] Test message$/
      );
    });

    it("should not include context when not provided", () => {
      logError("TEST_SERVICE", "Error occurred");

      const logCall = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logCall).not.toContain("{");
      expect(logCall).not.toContain("}");
    });
  });
});
