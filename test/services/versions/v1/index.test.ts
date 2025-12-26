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
import {
  ApiResponse,
  ChangelogResponse,
  MockGitHubRequest,
  UpdateResponse,
  VersionInfo,
  VersionsResponse
} from "../../../utils/test-types";

vi.mock("@octokit/request", () => ({
  request: vi.fn()
}));

import { request as ghRequest } from "@octokit/request";

let restoreConsole: (() => void) | null = null;
let originalKVPut: typeof env.CACHE_KV.put | null = null;

describe("Versions API v1", () => {
  beforeEach(async () => {
    restoreConsole = suppressConsole();
    await env.CACHE_KV.delete("gh-fossbilling-releases");

    // Set up UPDATE_TOKEN in AUTH_KV storage for tests
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
    if (restoreConsole) {
      restoreConsole();
      restoreConsole = null;
    }
    if (originalKVPut) {
      env.CACHE_KV.put = originalKVPut;
      originalKVPut = null;
    }
  });

  describe("GET /", () => {
    it("should return all releases", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: VersionsResponse = await response.json();

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error_code", 0);
      expect(data).toHaveProperty("message", null);
      expect(typeof data.result).toBe("object");
      expect(Object.keys(data.result)).toContain("0.5.0");
      expect(Object.keys(data.result)).toContain("0.6.0");
    });

    it("should cache releases data", async () => {
      const ctx = createExecutionContext();
      await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const cached = await env.CACHE_KV.get("gh-fossbilling-releases");
      expect(cached).toBeTruthy();
      expect(typeof cached).toBe("string");
    });

    it("should return cached data on subsequent requests", async () => {
      // First request to populate cache
      const ctx1 = createExecutionContext();
      await app.request("/versions/v1", {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      // Mock the GitHub API to throw an error to ensure we're using cache
      (
        vi.mocked(ghRequest) as unknown as MockGitHubRequest
      ).mockRejectedValueOnce(new Error("API Error"));

      // Second request should use cache
      const ctx2 = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

      expect(response.status).toBe(200);
      const data: VersionsResponse = await response.json();
      expect(Object.keys(data.result)).toContain("0.5.0");
    });
  });

  describe("GET /latest", () => {
    it("should return the latest release", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/latest", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ApiResponse<VersionInfo | null> = await response.json();

      expect(data).toHaveProperty("result");
      if (!data.result) {
        throw new Error("Expected latest release data");
      }
      expect(data.result.version).toBe("0.6.0");
      expect(data.result).toHaveProperty("released_on");
      expect(data.result).toHaveProperty("minimum_php_version");
      expect(data.result).toHaveProperty("download_url");
      expect(data.result).toHaveProperty("size_bytes");
      expect(data.result).toHaveProperty("is_prerelease", false);
      expect(data.result).toHaveProperty("github_release_id");
      expect(data.result).toHaveProperty("changelog");
    });
  });

  describe("GET /:version", () => {
    it("should return specific version", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/0.5.0", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ApiResponse<VersionInfo | null> = await response.json();

      expect(data).toHaveProperty("result");
      if (!data.result) {
        throw new Error("Expected version info for 0.5.0");
      }
      expect(data.result).toHaveProperty("version", "0.5.0");
    });

    it("should return 404 for non-existent version", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/999.999.999",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data: ApiResponse<VersionInfo | null> = await response.json();

      expect(data.result).toBe(null);
      expect(data).toHaveProperty("error_code", 404);
      expect(data.message).toContain("does not appear to exist");
    });

    it("should handle 'latest' alias", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/latest", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ApiResponse<VersionInfo | null> = await response.json();

      if (!data.result) {
        throw new Error("Expected version info for latest");
      }
      expect(data.result.version).toBe("0.6.0");
    });
  });

  describe("GET /build_changelog/:current", () => {
    it("should build changelog for current version", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/build_changelog/0.5.0",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ChangelogResponse = await response.json();

      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error_code", 0);
      expect(typeof data.result).toBe("string");
      expect(data.result).toContain("## 0.6.0");
    });

    it("should return empty changelog for latest version", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/build_changelog/0.6.0",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ChangelogResponse = await response.json();

      expect(data.result).toBe("");
    });

    it("should return 400 for invalid version", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/build_changelog/invalid",
        {},
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data: ChangelogResponse = await response.json();

      expect(data).toHaveProperty("result", null);
      expect(data).toHaveProperty("error_code", 400);
      expect(data.message).toContain("not a valid semantic version");
    });
  });

  describe("GET /update", () => {
    it("should update cache when authenticated", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer test-update-token-12345"
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: UpdateResponse = await response.json();

      expect(data).toHaveProperty("result");
      expect(data.result).toContain("Releases cache updated successfully");
      expect(data).toHaveProperty("error_code", 0);
    });

    it("should return 401 when not authenticated", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/update", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
    });

    it("should return 401 with wrong token", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer wrong-token"
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
    });
  });

  describe("Error Handling", () => {
    it("should handle GitHub API errors gracefully", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
        new Error("GitHub API Error")
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // When API fails and no cache is available, return 503
      expect(response.status).toBe(503);
      const data: VersionsResponse = await response.json();
      expect(data.error_code).toBe(503);
      expect(data.message).toContain("Unable to fetch releases");
    });

    it("should handle missing composer.json", async () => {
      // Mock GitHub to return error for composer.json
      (vi.mocked(ghRequest) as unknown as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: mockGitHubReleases };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            throw new Error("File not found");
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/0.5.0", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data: ApiResponse<VersionInfo | null> = await response.json();

      if (!data.result) {
        throw new Error("Expected version info for 0.5.0");
      }
      expect(data.result).toHaveProperty("version", "0.5.0");
      expect(data.result.minimum_php_version).toBe("");
    });

    describe("Empty releases cache retry logic", () => {
      it("should retry with updateCache when releases is empty", async () => {
        let callCount = 0;
        // First call returns empty, second call returns actual data
        (
          vi.mocked(ghRequest) as unknown as MockGitHubRequest
        ).mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return { data: [] };
          }
          return { data: mockGitHubReleases };
        });

        const ctx = createExecutionContext();
        const response = await app.request("/versions/v1/0.6.0", {}, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(response.status).toBe(200);
        const data: ApiResponse<VersionInfo | null> = await response.json();

        if (!data.result) {
          throw new Error("Expected version info for 0.6.0");
        }
        expect(data.result.version).toBe("0.6.0");

        // Should be called 6 times:
        // - First getReleases call: 1 call for releases (returns empty, no composer.json calls)
        // - Second getReleases call: 1 call for releases + 4 calls for composer.json (one per release)
        expect(vi.mocked(ghRequest)).toHaveBeenCalledTimes(6);
      });

      it("should return 404 when retry also fails", async () => {
        (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
          new Error("GitHub API Error")
        );
        (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
          new Error("GitHub API Error")
        );

        const ctx = createExecutionContext();
        const response = await app.request("/versions/v1/0.6.0", {}, env, ctx);
        await waitOnExecutionContext(ctx);

        // When both cache and API fetch fail, return 503 (service unavailable)
        expect(response.status).toBe(503);
        const data: ApiResponse<VersionInfo | null> = await response.json();

        expect(data.result).toBeNull();
        expect(data.error_code).toBe(503);
        expect(data.message).toContain("Unable to fetch releases");

        // Should have been called twice (initial attempt + retry)
        expect(vi.mocked(ghRequest)).toHaveBeenCalledTimes(2);
      });

      it("should return 404 for 'latest' when retry fails", async () => {
        (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
          new Error("GitHub API Error")
        );
        (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
          new Error("GitHub API Error")
        );

        const ctx = createExecutionContext();
        const response = await app.request("/versions/v1/latest", {}, env, ctx);
        await waitOnExecutionContext(ctx);

        // When both cache and API fetch fail, return 503 (service unavailable)
        expect(response.status).toBe(503);
        const data: ApiResponse<VersionInfo | null> = await response.json();

        expect(data.result).toBeNull();
        expect(data.error_code).toBe(503);
        expect(data.message).toContain("Unable to fetch releases");

        expect(vi.mocked(ghRequest)).toHaveBeenCalledTimes(2);
      });

      it("should succeed after retry with 'latest' alias", async () => {
        let callCount = 0;
        (
          vi.mocked(ghRequest) as unknown as MockGitHubRequest
        ).mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return { data: [] };
          }
          return { data: mockGitHubReleases };
        });

        const ctx = createExecutionContext();
        const response = await app.request("/versions/v1/latest", {}, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(response.status).toBe(200);
        const data: ApiResponse<VersionInfo | null> = await response.json();

        if (!data.result) {
          throw new Error("Expected latest release");
        }
        expect(data.result.version).toBe("0.6.0");

        // Should be called 6 times:
        // - First getReleases call: 1 call for releases (returns empty, no composer.json calls)
        // - Second getReleases call: 1 call for releases + 4 calls for composer.json (one per release)
        expect(vi.mocked(ghRequest)).toHaveBeenCalledTimes(6);
      });
    });
  });

  describe("Caching", () => {
    it("should respect cache TTL", async () => {
      const cachePutArgs: [string, string, { expirationTtl: number }?][] = [];
      originalKVPut = env.CACHE_KV.put;
      env.CACHE_KV.put = vi
        .fn()
        .mockImplementation(
          (key: string, value: string, options?: { expirationTtl: number }) => {
            cachePutArgs.push([key, value, options]);
            return originalKVPut!.call(env.CACHE_KV, key, value, options);
          }
        );

      const ctx = createExecutionContext();
      await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(env.CACHE_KV.put).toHaveBeenCalled();
      const putCall = cachePutArgs.find(
        (args) => args[0] === "gh-fossbilling-releases"
      );
      expect(putCall).toBeTruthy();
      expect(putCall![2]!).toHaveProperty("expirationTtl", 86400);
    });
  });
});
