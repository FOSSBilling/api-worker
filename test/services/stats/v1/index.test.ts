import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import app from "../../../../src/app";
import {
  mockGitHubReleases,
  mockComposerJson
} from "../../../mocks/github-releases";
import {
  suppressConsole,
  setupGitHubApiMock
} from "../../../utils/mock-helpers";
import { MockGitHubRequest } from "../../../utils/test-types";

import { request as ghRequest } from "@octokit/request";

vi.mock("@octokit/request", () => ({
  request: vi.fn()
}));

let restoreConsole: (() => void) | null = null;

describe("Stats API v1", () => {
  beforeEach(async () => {
    restoreConsole = suppressConsole();
    await env.CACHE_KV.delete("gh-fossbilling-releases");
    await env.CACHE_KV.delete("fossbilling-stats-data");

    const testUpdateToken = "test-update-token-12345";
    await env.AUTH_KV.put("UPDATE_TOKEN", testUpdateToken);

    vi.clearAllMocks();
    setupGitHubApiMock(
      vi.mocked(ghRequest) as MockGitHubRequest,
      mockGitHubReleases,
      mockComposerJson
    );
  });

  afterEach(() => {
    if (restoreConsole) restoreConsole();
  });

  describe("GET /stats/v1/data", () => {
    it("should return aggregated statistics", async () => {
      const ctx = createExecutionContext();
      const response = await app.fetch(
        new Request("http://localhost/stats/v1/data"),
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error_code", 0);
      expect(data.error_code).toBe(0);

      expect(data.result).toHaveProperty("releaseSizes");
      expect(data.result).toHaveProperty("phpVersions");
      expect(data.result).toHaveProperty("patchesPerRelease");
      expect(data.result).toHaveProperty("releasesPerYear");

      expect(Array.isArray(data.result.releaseSizes)).toBe(true);
      expect(Array.isArray(data.result.phpVersions)).toBe(true);
      expect(Array.isArray(data.result.patchesPerRelease)).toBe(true);
      expect(Array.isArray(data.result.releasesPerYear)).toBe(true);

      if (data.result.releaseSizes.length > 0) {
        expect(data.result.releaseSizes[0]).toHaveProperty("version");
        expect(data.result.releaseSizes[0]).toHaveProperty("size_mb");
        expect(data.result.releaseSizes[0]).toHaveProperty("released_on");
        expect(typeof data.result.releaseSizes[0].size_mb).toBe("number");
      }

      if (data.result.phpVersions.length > 0) {
        expect(data.result.phpVersions[0]).toHaveProperty("version");
        expect(data.result.phpVersions[0]).toHaveProperty("php_version");
        expect(data.result.phpVersions[0]).toHaveProperty("released_on");
      }

      if (data.result.patchesPerRelease.length > 0) {
        expect(data.result.patchesPerRelease[0]).toHaveProperty("version_line");
        expect(data.result.patchesPerRelease[0]).toHaveProperty("patch_count");
        expect(typeof data.result.patchesPerRelease[0].patch_count).toBe(
          "number"
        );
      }

      if (data.result.releasesPerYear.length > 0) {
        expect(data.result.releasesPerYear[0]).toHaveProperty("year");
        expect(data.result.releasesPerYear[0]).toHaveProperty("release_count");
        expect(typeof data.result.releasesPerYear[0].release_count).toBe(
          "number"
        );
      }
    });

    it("should cache statistics data", async () => {
      const ctx1 = createExecutionContext();
      const response1 = await app.fetch(
        new Request("http://localhost/stats/v1/data"),
        env,
        ctx1
      );
      await waitOnExecutionContext(ctx1);

      expect(response1.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data1: any = await response1.json();

      const ctx2 = createExecutionContext();
      const response2 = await app.fetch(
        new Request("http://localhost/stats/v1/data"),
        env,
        ctx2
      );
      await waitOnExecutionContext(ctx2);

      expect(response2.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data2: any = await response2.json();

      expect(data1.result).toEqual(data2.result);
      expect(data2.stale).toBe(false);
    });

    it("should handle empty releases data gracefully", async () => {
      vi.mocked(ghRequest).mockResolvedValue({
        data: [],
        headers: {},
        status: 200,
        url: "https://api.github.com/repos/FOSSBilling/FOSSBilling/releases"
      });

      const ctx = createExecutionContext();
      const response = await app.fetch(
        new Request("http://localhost/stats/v1/data"),
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json();

      expect(data.result).toHaveProperty("releaseSizes", []);
      expect(data.result).toHaveProperty("phpVersions", []);
      expect(data.result).toHaveProperty("patchesPerRelease", []);
      expect(data.result).toHaveProperty("releasesPerYear", []);
    });
  });

  describe("GET /stats/v1/", () => {
    it("should return HTML page", async () => {
      const ctx = createExecutionContext();
      const response = await app.fetch(
        new Request("http://localhost/stats/v1"),
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      expect(html).toContain("FOSSBilling Release Statistics");
      expect(html).toContain('id="releaseSizeChart"');
      expect(html).toContain('id="phpVersionChart"');
      expect(html).toContain('id="patchesChart"');
      expect(html).toContain('id="releasesPerYearChart"');
      expect(html).toContain(
        'src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0'
      );
    });
  });
});
