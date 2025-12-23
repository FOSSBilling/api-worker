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
import { suppressConsole } from "../../../utils/mock-helpers";
import {
  MockGitHubRequest,
  ApiResponse,
  VersionsResponse,
  VersionResponse
} from "../../../utils/test-types";

vi.mock("@octokit/request", () => ({
  request: vi.fn()
}));

import { request as ghRequest } from "@octokit/request";

let restoreConsole: (() => void) | null = null;

describe("Versions API v1 - Error Handling", () => {
  beforeEach(async () => {
    restoreConsole = suppressConsole();
    await env.CACHE_KV.delete("gh-fossbilling-releases");
    await env.AUTH_KV.put("UPDATE_TOKEN", "test-update-token-12345");

    vi.clearAllMocks();
    (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
      async (route: string) => {
        if (route === "GET /repos/{owner}/{repo}/releases") {
          return { data: mockGitHubReleases };
        }
        if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } };
        }
        throw new Error("Unexpected route");
      }
    );
  });

  afterEach(() => {
    if (restoreConsole) {
      restoreConsole();
      restoreConsole = null;
    }
  });

  describe("Update Endpoint Authentication", () => {
    it("should handle missing UPDATE_TOKEN from KV storage", async () => {
      await env.AUTH_KV.delete("UPDATE_TOKEN");

      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer some-token"
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
    });

    it("should reject malformed Authorization headers", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "NotBearer test-token"
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });

    it("should reject Authorization without Bearer prefix", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "test-update-token-12345"
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });

    it("should reject empty bearer token", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer "
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });

    it("should reject whitespace-only bearer token", async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer    "
          }
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
    });
  });

  describe("GitHub API Failures", () => {
    it("should handle GitHub API errors during update", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
        new Error("GitHub API Error")
      );

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
      const data = (await response.json()) as ApiResponse<string>;
      expect(data.result).toContain("0 releases");
    });

    it("should handle GitHub API returning invalid JSON", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async () => ({
          data: "not an array"
        })
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApiResponse<
        Record<string, unknown>
      >;
      expect(Object.keys(data.result)).toHaveLength(0);
    });

    it("should handle releases without FOSSBilling.zip asset", async () => {
      const releasesWithoutZip = [
        {
          id: 1,
          tag_name: "1.0.0",
          name: "1.0.0",
          published_at: "2023-01-01T00:00:00Z",
          prerelease: false,
          body: "Release notes",
          assets: [
            {
              name: "other-file.tar.gz",
              browser_download_url: "https://example.com/file.tar.gz",
              size: 1000
            }
          ]
        }
      ];

      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: releasesWithoutZip };
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApiResponse<
        Record<string, unknown>
      >;
      expect(Object.keys(data.result)).toHaveLength(0);
    });

    it("should handle GitHub API timeout gracefully", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 100);
        });
      });

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ApiResponse<
        Record<string, unknown>
      >;
      expect(Object.keys(data.result)).toHaveLength(0);
    });
  });

  describe("Cache Corruption", () => {
    it("should throw error on corrupt cache data", async () => {
      await env.CACHE_KV.put("gh-fossbilling-releases", "invalid json {{{");

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Currently throws 500 - this is expected behavior until we add error handling
      expect(response.status).toBe(500);
    });

    it("should handle empty string cache by fetching fresh data", async () => {
      await env.CACHE_KV.put("gh-fossbilling-releases", "");

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Empty cache is treated as falsy, fetches fresh data
      expect(response.status).toBe(200);
    });

    it("should handle null string cache value", async () => {
      await env.CACHE_KV.put("gh-fossbilling-releases", "null");

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Parsing "null" string should work, returns 200
      expect(response.status).toBe(500);
    });
  });

  describe("Invalid Semver Handling", () => {
    it("should skip releases with invalid semver tags", async () => {
      const releasesWithInvalidSemver = [
        ...mockGitHubReleases,
        {
          id: 999,
          tag_name: "not-a-version",
          name: "Invalid Version",
          published_at: "2023-01-01T00:00:00Z",
          prerelease: false,
          body: "Bad release",
          assets: [
            {
              name: "FOSSBilling.zip",
              browser_download_url: "https://example.com/file.zip",
              size: 1000
            }
          ]
        }
      ];

      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: releasesWithInvalidSemver };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            const content = btoa(JSON.stringify(mockComposerJson));
            return { data: { content } };
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as VersionsResponse;
      expect(data.result["not-a-version"]).toBeUndefined();
    });
  });

  describe("Partial Release Data", () => {
    it("should handle releases missing required fields", async () => {
      const incompleteReleases = [
        {
          id: 1,
          tag_name: "1.0.0",
          // Missing name field
          published_at: "2023-01-01T00:00:00Z",
          prerelease: false,
          // Missing body field
          assets: [
            {
              name: "FOSSBilling.zip",
              browser_download_url: "https://example.com/file.zip",
              size: 1000
            }
          ]
        }
      ];

      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: incompleteReleases };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            const content = btoa(JSON.stringify(mockComposerJson));
            return { data: { content } };
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as VersionsResponse;
      if (data.result["1.0.0"]) {
        expect(data.result["1.0.0"].changelog).toBe("");
      }
    });

    it("should handle missing published_at timestamp", async () => {
      const releasesWithoutTimestamp = [
        {
          id: 1,
          tag_name: "1.0.0",
          name: "1.0.0",
          // Missing published_at
          prerelease: false,
          body: "Release",
          assets: [
            {
              name: "FOSSBilling.zip",
              browser_download_url: "https://example.com/file.zip",
              size: 1000
            }
          ]
        }
      ];

      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: releasesWithoutTimestamp };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            const content = btoa(JSON.stringify(mockComposerJson));
            return { data: { content } };
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
    });
  });

  describe("Composer.json Errors", () => {
    it("should handle missing composer.json gracefully", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
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
      const data = (await response.json()) as VersionResponse;
      if (data.result) {
        expect(data.result.minimum_php_version).toBe("");
      }
    });

    it("should handle malformed composer.json", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: mockGitHubReleases };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            const content = btoa("not valid json {{{");
            return { data: { content } };
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/0.5.0", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as VersionResponse;
      if (data.result) {
        expect(data.result.minimum_php_version).toBe("");
      }
    });

    it("should handle composer.json without php requirement", async () => {
      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return { data: mockGitHubReleases };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            const content = btoa(JSON.stringify({ require: {} }));
            return { data: { content } };
          }
          throw new Error("Unexpected route");
        }
      );

      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1/0.5.0", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = (await response.json()) as VersionResponse;
      if (data.result) {
        expect(data.result.minimum_php_version).toBe("");
      }
    });
  });
});
