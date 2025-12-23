import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import app from "../../../../src/app";
import { mockReleases } from "../../../mocks/releases";
import { suppressConsole } from "../../../utils/mock-helpers";
import type { ReleasesResponse } from "../../../utils/test-types";
import { getReleases } from "../../../../src/services/versions/v1";
import { Releases } from "../../../../src/services/versions/v1/interfaces";

vi.mock("../../../../src/services/versions/v1", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../../../src/services/versions/v1")
    >();
  return {
    ...actual,
    getReleases: vi.fn()
  };
});

let restoreConsole: (() => void) | null = null;

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
  });

  describe("GET /", () => {
    it("should return releases with support status", async () => {
      vi.mocked(getReleases).mockResolvedValue(mockReleases);

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

    it("should handle errors gracefully", async () => {
      vi.mocked(getReleases).mockRejectedValue(new Error("Database error"));

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data: ReleasesResponse = await response.json();

      expect(data).toHaveProperty("result", null);
      expect(data).toHaveProperty("error");
      expect(data.error).toBeTruthy();
    });
  });

  describe("Support Status Calculation", () => {
    it("should mark old versions as unsupported", async () => {
      const mockData = {
        "0.1.0": { version: "0.1.0" },
        "0.2.0": { version: "0.2.0" }
      };

      vi.mocked(getReleases).mockResolvedValue(mockData as unknown as Releases);

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();
      const versions = data.result.versions;
      expect(versions[0].support).toBe("insecure");
      expect(versions[1].support).toBe("latest");
    });

    it("should mark recent versions as supported", async () => {
      const mockData = {
        "0.5.0": { version: "0.5.0" },
        "0.6.0": { version: "0.6.0" }
      };

      vi.mocked(getReleases).mockResolvedValue(mockData as unknown as Releases);

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();
      const versions = data.result.versions;
      expect(versions[0].support).toBe("insecure");
      expect(versions[1].support).toBe("latest");
    });
  });

  describe("Deprecation Headers", () => {
    it("should include all required deprecation headers", async () => {
      vi.mocked(getReleases).mockResolvedValue(mockReleases);

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
      vi.mocked(getReleases).mockResolvedValue({});

      const ctx = createExecutionContext();
      const response = await app.request("/releases/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ReleasesResponse = await response.json();

      expect(data.result.versions).toHaveLength(0);
    });
  });
});
