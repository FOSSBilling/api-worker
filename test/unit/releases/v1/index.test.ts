import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import app from "../../../../src";
import { mockVersionsApiResponse } from "../../../fixtures/releases";
import {
  suppressConsole,
  createMockFetchResponse
} from "../../../utils/mock-helpers";
import type { ReleasesResponse } from "../../../utils/test-types";

let restoreConsole: (() => void) | null = null;
let fetchSpy: ReturnType<typeof vi.spyOn<typeof global, "fetch">> | null = null;

describe("Releases API v1 (Deprecated)", () => {
  beforeEach(() => {
    restoreConsole = suppressConsole();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (restoreConsole) {
      restoreConsole();
      restoreConsole = null;
    }

    if (fetchSpy) {
      fetchSpy.mockRestore();
      fetchSpy = null;
    }
  });

  describe("GET /", () => {
    it("should return releases with support status", async () => {
      fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          createMockFetchResponse(
            mockVersionsApiResponse
          ) as unknown as Response
        );

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error");
      expect(data.result).toHaveProperty("versions");
      expect(Array.isArray(data.result.versions)).toBe(true);

      // Check deprecation headers
      expect(response.headers.get("Deprecation")).toBeTruthy();
      expect(response.headers.get("Sunset")).toBeTruthy();
      expect(response.headers.get("Link")).toBeTruthy();
    });

    it("should handle fetch errors gracefully", async () => {
      fetchSpy = vi
        .spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Network error"));

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data: ReleasesResponse = await response.json();

      expect(data).toHaveProperty("result", null);
      expect(data).toHaveProperty("error");
      expect(data.error).toBeTruthy();
    });

    it("should handle invalid JSON response", async () => {
      fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        }
      } as unknown as Response);

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data: ReleasesResponse = await response.json();

      expect(data).toHaveProperty("result", null);
      expect(data).toHaveProperty("error");
    });
  });

  describe("Support Status Calculation", () => {
    it("should mark old versions as unsupported", async () => {
      const mockData = {
        result: {
          "0.1.0": { version: "0.1.0" },
          "0.2.0": { version: "0.2.0" }
        }
      };

      fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          createMockFetchResponse(mockData) as unknown as Response
        );

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();
      const versions = data.result.versions;
      expect(versions[0].support).toBe("supported");
      expect(versions[1].support).toBe("supported");
    });

    it("should mark recent versions as supported", async () => {
      const mockData = {
        result: {
          "0.5.0": { version: "0.5.0" },
          "0.6.0": { version: "0.6.0" }
        }
      };

      fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          createMockFetchResponse(mockData) as unknown as Response
        );

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();
      const versions = data.result.versions;
      expect(versions[0].support).toBe("supported");
      expect(versions[1].support).toBe("supported");
    });
  });

  describe("Deprecation Headers", () => {
    it("should include all required deprecation headers", async () => {
      fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          createMockFetchResponse(
            mockVersionsApiResponse
          ) as unknown as Response
        );

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get("Deprecation")).toBe("true");
      expect(response.headers.get("Sunset")).toBeTruthy();
      expect(response.headers.get("Link")).toBeTruthy();

      const linkHeader = response.headers.get("Link");
      expect(linkHeader).toContain('rel="successor-version"');
      expect(linkHeader).toContain("/versions/v1");
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1/unknown", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });

    it("should handle missing versions data", async () => {
      fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          createMockFetchResponse({ result: {} }) as unknown as Response
        );

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();

      expect(data.result.versions).toHaveLength(0);
    });
  });
});
