import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import app from "../../../src/app";
import {
  mockGitHubReleases,
  mockComposerJson
} from "../../mocks/github-releases";
import { setupGitHubApiMock } from "../../utils/mock-helpers";
import {
  MockGitHubRequest,
  VersionsResponse,
  ApiResponse
} from "../../utils/test-types";

vi.mock("@octokit/request", () => ({
  request: vi.fn()
}));

import { request as ghRequest } from "@octokit/request";

describe("Versions API v1 - Integration Tests", () => {
  beforeEach(async () => {
    await env.CACHE_KV.delete("gh-fossbilling-releases");
    await env.AUTH_KV.put("UPDATE_TOKEN", "test-update-token-12345");

    vi.clearAllMocks();
    setupGitHubApiMock(
      vi.mocked(ghRequest) as MockGitHubRequest,
      mockGitHubReleases,
      mockComposerJson
    );
  });

  describe("Full Request/Response Cycle", () => {
    it("should handle complete flow from request to cached response", async () => {
      // First request - fetch from GitHub
      const ctx1 = createExecutionContext();
      const response1 = await app.request("/versions/v1", {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      expect(response1.status).toBe(200);
      const data1: VersionsResponse = await response1.json();
      expect(Object.keys(data1.result).length).toBeGreaterThan(0);

      // Verify data was cached
      const cached = await env.CACHE_KV.get("gh-fossbilling-releases");
      expect(cached).toBeTruthy();

      // Second request - should use cache
      const ctx2 = createExecutionContext();
      const response2 = await app.request("/versions/v1", {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

      expect(response2.status).toBe(200);
      const data2: VersionsResponse = await response2.json();
      expect(data1).toEqual(data2);
    });

    it("should handle update flow with authentication", async () => {
      // Initial state - no cache
      let cached = await env.CACHE_KV.get("gh-fossbilling-releases");
      expect(cached).toBeFalsy();

      // Call update endpoint
      const ctx1 = createExecutionContext();
      const response1 = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer test-update-token-12345"
          }
        },
        env,
        ctx1
      );
      await waitOnExecutionContext(ctx1);

      expect(response1.status).toBe(200);
      const data1 = (await response1.json()) as ApiResponse<string>;
      expect(data1.result).toContain("updated successfully");

      // Verify cache was populated
      cached = await env.CACHE_KV.get("gh-fossbilling-releases");
      expect(cached).toBeTruthy();

      // Subsequent request should use cache
      const ctx2 = createExecutionContext();
      const response2 = await app.request("/versions/v1", {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

      expect(response2.status).toBe(200);
    });

    it("should return correct data across all endpoints", async () => {
      // Get all versions
      const ctx1 = createExecutionContext();
      const response1 = await app.request("/versions/v1", {}, env, ctx1);
      await waitOnExecutionContext(ctx1);
      const allVersions: VersionsResponse = await response1.json();

      // Get latest version
      const ctx2 = createExecutionContext();
      const response2 = await app.request("/versions/v1/latest", {}, env, ctx2);
      await waitOnExecutionContext(ctx2);
      const latest = (await response2.json()) as VersionsResponse;

      // Get specific version
      const ctx3 = createExecutionContext();
      const response3 = await app.request("/versions/v1/0.6.0", {}, env, ctx3);
      await waitOnExecutionContext(ctx3);
      const specific = (await response3.json()) as VersionsResponse;

      // Verify consistency
      expect(latest.result).toEqual(allVersions.result["0.6.0"]);
      expect(specific.result).toEqual(allVersions.result["0.6.0"]);
    });
  });

  describe("Cache Behavior", () => {
    it("should use cache across multiple requests", async () => {
      const requests = 5;
      const responses = [];

      for (let i = 0; i < requests; i++) {
        const ctx = createExecutionContext();
        const response = await app.request("/versions/v1", {}, env, ctx);
        await waitOnExecutionContext(ctx);
        responses.push(await response.json());
      }

      // All responses should be identical
      for (let i = 1; i < requests; i++) {
        expect(responses[i]).toEqual(responses[0]);
      }

      // GitHub API should only be called once (first request)
      expect(vi.mocked(ghRequest)).toHaveBeenCalled();
    });

    it("should refresh cache when update endpoint is called", async () => {
      // First request
      const ctx1 = createExecutionContext();
      await app.request("/versions/v1", {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      const cachedBefore = await env.CACHE_KV.get("gh-fossbilling-releases");

      // Modify mock to return different data
      (vi.mocked(ghRequest) as MockGitHubRequest).mockImplementation(
        async (route: string) => {
          if (route === "GET /repos/{owner}/{repo}/releases") {
            return {
              data: [
                {
                  id: 9999,
                  tag_name: "9.9.9",
                  name: "9.9.9",
                  published_at: "2024-01-01T00:00:00Z",
                  prerelease: false,
                  body: "New release",
                  assets: [
                    {
                      name: "FOSSBilling.zip",
                      browser_download_url: "https://example.com/new.zip",
                      size: 2000000
                    }
                  ]
                }
              ]
            };
          }
          if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
            const content = btoa(JSON.stringify(mockComposerJson));
            return { data: { content } };
          }
          throw new Error("Unexpected route");
        }
      );

      // Call update endpoint
      const ctx2 = createExecutionContext();
      await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer test-update-token-12345"
          }
        },
        env,
        ctx2
      );
      await waitOnExecutionContext(ctx2);

      const cachedAfter = await env.CACHE_KV.get("gh-fossbilling-releases");

      // Cache should be different
      expect(cachedAfter).not.toBe(cachedBefore);
      expect(cachedAfter).toContain("9.9.9");
    });

    it("should handle concurrent requests gracefully", async () => {
      await env.CACHE_KV.delete("gh-fossbilling-releases");

      // Make 10 concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const ctx = createExecutionContext();
        const promise = (async () => {
          const response = await app.request("/versions/v1", {}, env, ctx);
          await waitOnExecutionContext(ctx);
          return response.json();
        })();
        promises.push(promise);
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        const r = result as ApiResponse;
        expect(r.error_code).toBe(0);
        expect(
          Object.keys(r.result as Record<string, unknown>).length
        ).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Recovery", () => {
    it("should recover from GitHub API failure using cache", async () => {
      // First request to populate cache
      const ctx1 = createExecutionContext();
      await app.request("/versions/v1", {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      // Mock GitHub API to fail
      (vi.mocked(ghRequest) as MockGitHubRequest).mockRejectedValueOnce(
        new Error("GitHub API Error")
      );

      // Second request should use cache
      const ctx2 = createExecutionContext();
      const response2 = await app.request("/versions/v1", {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

      expect(response2.status).toBe(200);
      const data: VersionsResponse = await response2.json();
      expect(Object.keys(data.result).length).toBeGreaterThan(0);
    });

    it("should work after authentication failure then success", async () => {
      // First attempt - wrong token
      const ctx1 = createExecutionContext();
      const response1 = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer wrong-token"
          }
        },
        env,
        ctx1
      );
      await waitOnExecutionContext(ctx1);

      expect(response1.status).toBe(401);

      // Second attempt - correct token
      const ctx2 = createExecutionContext();
      const response2 = await app.request(
        "/versions/v1/update",
        {
          headers: {
            Authorization: "Bearer test-update-token-12345"
          }
        },
        env,
        ctx2
      );
      await waitOnExecutionContext(ctx2);

      expect(response2.status).toBe(200);
    });
  });

  describe("Service Integration", () => {
    it("should work when called through main app router", async () => {
      const ctx = createExecutionContext();
      const response = await app.request("/versions/v1", {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

      const data: VersionsResponse = await response.json();
      expect(data).toHaveProperty("result");
      expect(data).toHaveProperty("error_code", 0);
      expect(data).toHaveProperty("message", null);
    });

    it("should maintain consistent API response format", async () => {
      const endpoints = [
        "/versions/v1",
        "/versions/v1/latest",
        "/versions/v1/0.6.0"
      ];

      for (const endpoint of endpoints) {
        const ctx = createExecutionContext();
        const response = await app.request(endpoint, {}, env, ctx);
        await waitOnExecutionContext(ctx);

        const data = await response.json();
        expect(data).toHaveProperty("result");
        expect(data).toHaveProperty("error_code");
        expect(data).toHaveProperty("message");
      }
    });
  });
});
