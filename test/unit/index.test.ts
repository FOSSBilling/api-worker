/**
 * Tests for FOSSBilling API Worker - Main Application
 *
 * @license AGPL-3.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import app from '../../src/index';

// Mock @octokit/request for versions API integration
vi.mock('@octokit/request', () => ({
  request: vi.fn(),
}));

import { request as ghRequest } from '@octokit/request';

const mockGitHubReleases = [
  {
    id: 1001,
    tag_name: '0.6.0',
    name: '0.6.0',
    published_at: '2023-04-01T00:00:00Z',
    prerelease: false,
    body: '## 0.6.0\n- New features',
    assets: [
      {
        name: 'FOSSBilling.zip',
        browser_download_url: 'https://github.com/FOSSBilling/FOSSBilling/releases/download/0.6.0/FOSSBilling.zip',
        size: 1030000,
      },
    ],
  },
];

const mockComposerJson = {
  require: {
    php: '^8.1',
  },
};

describe('FOSSBilling API Worker - Main App', () => {
  beforeEach(async () => {
    // Clear KV cache before each test
    await env.CACHE_KV.delete('gh-fossbilling-releases');

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default GitHub API mock responses
    vi.mocked(ghRequest).mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/releases') {
        return { data: mockGitHubReleases } as any;
      }
      if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
        const content = btoa(JSON.stringify(mockComposerJson));
        return {
          data: {
            content: content,
          },
        } as any;
      }
      throw new Error('Unexpected route');
    });
  });

  describe('Route Delegation', () => {
    it('should route /versions/v1 to versions service', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return versions API response format
      expect(data).toHaveProperty('result');
      expect(data).toHaveProperty('error_code');
      expect(data).toHaveProperty('message');
    });

    it('should route /releases/v1 to releases service', async () => {
      // Mock internal fetch call that releases service makes to versions service
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            '0.5.0': { version: '0.5.0' },
            '0.6.0': { version: '0.6.0' },
          },
        }),
      }) as any;

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return releases API response format with deprecation headers
      expect(data).toHaveProperty('result');
      expect(data).toHaveProperty('error');
      expect(response.headers.get('Deprecation')).toBeTruthy();
      expect(response.headers.get('Sunset')).toBeTruthy();

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should route /central-alerts/v1/list to central alerts service', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return central alerts response format
      expect(data).toHaveProperty('result');
      expect(data.result).toHaveProperty('alerts');
      expect(Array.isArray(data.result.alerts)).toBe(true);
    });

    it('should return 404 for unknown routes', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/unknown/path', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });

    it('should return 404 for root path', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });
  });

  describe('Context Storage Middleware', () => {
    it('should make context available to nested routes', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // If context storage works, the versions endpoint should be able to access env bindings
      expect(response.status).toBe(200);
      const data = await response.json();

      // Should successfully fetch from GitHub (via context storage)
      expect(data.result).toBeTruthy();
    });

    it('should provide access to KV namespace through context', async () => {
      const ctx = createExecutionContext();
      await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Verify that KV was accessed (data should be cached)
      const cached = await env.CACHE_KV.get('gh-fossbilling-releases');
      expect(cached).toBeTruthy();
    });

    it('should provide access to environment variables through context', async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        '/versions/v1/update',
        {
          headers: {
            Authorization: `Bearer ${env.UPDATE_TOKEN}`,
          },
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      // Should be able to access UPDATE_TOKEN from context
      expect(response.status).toBe(200);
    });
  });

  describe('Service Integration', () => {
    it('should allow versions service to function correctly', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/latest', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toBeTruthy();
      expect(data.result.version).toBe('0.6.0');
    });

    it('should allow releases service to fetch from versions service', async () => {
      // Mock internal fetch call that releases service makes
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            '0.5.0': { version: '0.5.0' },
            '0.6.0': { version: '0.6.0' },
          },
        }),
      }) as any;

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Releases service internally calls versions service
      expect(data.result).toBeTruthy();
      expect(data.result.versions).toBeTruthy();

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should allow central alerts service to return static data', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('HTTP Methods', () => {
    it('should handle GET requests', async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        '/versions/v1',
        {
          method: 'GET',
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
    });

    it('should return 404 for unsupported methods on unknown routes', async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        '/versions/v1',
        {
          method: 'POST',
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      // Hono returns 404 for unsupported methods
      expect(response.status).toBe(404);
    });
  });

  describe('Request Headers', () => {
    it('should handle requests with various headers', async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        '/versions/v1',
        {
          headers: {
            'User-Agent': 'TestClient/1.0',
            'Accept': 'application/json',
          },
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
    });

    it('should handle authorization headers for protected endpoints', async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        '/versions/v1/update',
        {
          headers: {
            Authorization: `Bearer ${env.UPDATE_TOKEN}`,
          },
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
    });
  });

  describe('Multiple Sequential Requests', () => {
    it('should handle multiple requests to different services', async () => {
      // Request to versions service
      const ctx1 = createExecutionContext();
      const response1 = await app.request('/versions/v1', {}, env, ctx1);
      await waitOnExecutionContext(ctx1);
      expect(response1.status).toBe(200);

      // Request to central alerts service
      const ctx2 = createExecutionContext();
      const response2 = await app.request('/central-alerts/v1/list', {}, env, ctx2);
      await waitOnExecutionContext(ctx2);
      expect(response2.status).toBe(200);

      // Request to releases service - mock internal fetch
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            '0.5.0': { version: '0.5.0' },
            '0.6.0': { version: '0.6.0' },
          },
        }),
      }) as any;

      const ctx3 = createExecutionContext();
      const response3 = await app.request('/releases/v1', {}, env, ctx3);
      await waitOnExecutionContext(ctx3);
      expect(response3.status).toBe(200);

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should maintain separate execution contexts', async () => {
      const ctx1 = createExecutionContext();
      const response1 = await app.request('/versions/v1/latest', {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      const ctx2 = createExecutionContext();
      const response2 = await app.request('/versions/v1/0.6.0', {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // Both should succeed independently
      expect(data1.result.version).toBe('0.6.0');
      expect(data2.result.version).toBe('0.6.0');
    });
  });

  describe('Query Parameters', () => {
    it('should handle requests with query parameters', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1?format=pretty', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Should still work (query params ignored)
      expect(response.status).toBe(200);
    });
  });

  describe('Cloudflare Bindings', () => {
    it('should have access to CACHE_KV binding', async () => {
      expect(env.CACHE_KV).toBeDefined();

      // Test KV operations
      await env.CACHE_KV.put('test-key', 'test-value');
      const value = await env.CACHE_KV.get('test-key');
      expect(value).toBe('test-value');

      await env.CACHE_KV.delete('test-key');
    });

    it('should have access to GITHUB_TOKEN binding', async () => {
      expect(env.GITHUB_TOKEN).toBeDefined();
      expect(typeof env.GITHUB_TOKEN).toBe('string');
    });

    it('should have access to UPDATE_TOKEN binding', async () => {
      expect(env.UPDATE_TOKEN).toBeDefined();
      expect(typeof env.UPDATE_TOKEN).toBe('string');
    });
  });
});
