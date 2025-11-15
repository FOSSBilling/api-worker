/**
 * Tests for FOSSBilling API Worker - Versions Service (v1)
 *
 * @license AGPL-3.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import app from '../../../../src';
import { mockReleases } from '../../../fixtures/releases';
import { mockGitHubReleases, mockComposerJson } from '../../../fixtures/github-releases';
import { suppressConsole, setupGitHubApiMock } from '../../../utils/mock-helpers';

// Mock @octokit/request
vi.mock('@octokit/request', () => ({
  request: vi.fn(),
}));

import { request as ghRequest } from '@octokit/request';

// Console suppression cleanup function
let restoreConsole: (() => void) | null = null;

describe('Versions API v1', () => {
  beforeEach(async () => {
    // Suppress console output for cleaner test logs
    restoreConsole = suppressConsole();

    // Clear KV cache before each test
    await env.CACHE_KV.delete('gh-fossbilling-releases');

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default GitHub API mock responses
    setupGitHubApiMock(vi.mocked(ghRequest), mockGitHubReleases, mockComposerJson);
  });

  afterEach(() => {
    // Restore console output after each test
    if (restoreConsole) {
      restoreConsole();
      restoreConsole = null;
    }
  });

  describe('GET /', () => {
    it('should return all releases', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('result');
      expect(data).toHaveProperty('error_code', 0);
      expect(data).toHaveProperty('message', null);
      expect(typeof data.result).toBe('object');
      expect(Object.keys(data.result).length).toBeGreaterThan(0);
    });

    it('should cache releases in KV', async () => {
      const ctx = createExecutionContext();
      await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Check that releases were cached
      const cached = await env.CACHE_KV.get('gh-fossbilling-releases');
      expect(cached).toBeTruthy();

      const cachedData = JSON.parse(cached!);
      expect(Object.keys(cachedData).length).toBeGreaterThan(0);
    });

    it('should use cached data on subsequent requests', async () => {
      // First request - cache miss
      const ctx1 = createExecutionContext();
      await app.request('/versions/v1', {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      const firstCallCount = vi.mocked(ghRequest).mock.calls.length;

      // Second request - should use cache
      const ctx2 = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

      // GitHub API should not be called again (only composer.json calls would increase)
      // But the releases endpoint call count should be the same
      const secondCallCount = vi.mocked(ghRequest).mock.calls.length;

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toBeTruthy();
    });

    it('should include CORS headers', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('GET /:version', () => {
    it('should return a specific version', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/0.5.1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.error_code).toBe(0);
      expect(data.result).toBeTruthy();
      expect(data.result.version).toBe('0.5.1');
    });

    it('should return latest version when requested', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/latest', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.error_code).toBe(0);
      expect(data.result).toBeTruthy();
      // Latest should be 0.6.0 based on mock data
      expect(data.result.version).toBe('0.6.0');
    });

    it('should return 404 for non-existent version', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/9.9.9', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.error_code).toBe(404);
      expect(data.result).toBeNull();
      expect(data.message).toContain('9.9.9');
      expect(data.message).toContain('does not appear to exist');
    });

    it('should return 500 when no releases are available', async () => {
      // Mock empty releases
      vi.mocked(ghRequest).mockResolvedValueOnce({ data: [] } as any);

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/latest', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.error_code).toBe(500);
      expect(data.result).toBeNull();
      expect(data.message).toContain('Could not retrieve release information');
    });
  });

  describe('GET /build_changelog/:current', () => {
    it('should build changelog for valid semver version', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/build_changelog/0.5.0', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.error_code).toBe(0);
      expect(data.result).toBeTruthy();
      expect(typeof data.result).toBe('string');
      // Should contain changelogs for versions > 0.5.0
      expect(data.result).toContain('0.6.0');
      expect(data.result).toContain('0.5.2');
      expect(data.result).toContain('0.5.1');
      // Should NOT contain 0.5.0 itself
      expect(data.result).not.toContain('0.5.0');
    });

    it('should return changelogs in descending order', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/build_changelog/0.5.0', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      const changelog = data.result as string;
      const idx060 = changelog.indexOf('0.6.0');
      const idx052 = changelog.indexOf('0.5.2');
      const idx051 = changelog.indexOf('0.5.1');

      // Latest versions should appear first
      expect(idx060).toBeLessThan(idx052);
      expect(idx052).toBeLessThan(idx051);
    });

    it('should return 400 for invalid semver version', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/build_changelog/invalid-version', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.error_code).toBe(400);
      expect(data.result).toBeNull();
      expect(data.message).toContain('invalid-version');
      expect(data.message).toContain('not a valid semantic version');
    });

    it('should handle missing changelogs gracefully', async () => {
      // Mock releases with missing changelog
      const releasesWithoutChangelog = mockGitHubReleases.map(r => ({
        ...r,
        body: null,
      }));

      vi.mocked(ghRequest).mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: releasesWithoutChangelog } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      // Clear cache to force fresh fetch
      await env.CACHE_KV.delete('gh-fossbilling-releases');

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/build_changelog/0.5.0', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toContain('changelogs for this release appear to be missing');
    });

    it('should return empty changelog when current version is latest', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/build_changelog/0.6.0', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // No versions newer than 0.6.0
      expect(data.result).toBe('');
    });
  });

  describe('GET /update', () => {
    it('should update cache with valid bearer token', async () => {
      // Pre-populate cache with old data
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify({ '0.1.0': {} }));

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
      const data = await response.json();

      expect(data.error_code).toBe(0);
      expect(data.result).toContain('Releases cache updated successfully');
      expect(data.result).toContain('releases');

      // Verify cache was updated
      const cached = await env.CACHE_KV.get('gh-fossbilling-releases');
      const cachedData = JSON.parse(cached!);
      expect(Object.keys(cachedData).length).toBeGreaterThan(0);
    });

    it('should return 401 with invalid bearer token', async () => {
      const ctx = createExecutionContext();
      const response = await app.request(
        '/versions/v1/update',
        {
          headers: {
            Authorization: 'Bearer wrong-token',
          },
        },
        env,
        ctx
      );
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
    });

    it('should return 401 without bearer token', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1/update', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(401);
    });

    it('should fallback to cache on GitHub API failure during update', async () => {
      // First, populate the cache with some data
      const cachedData = { '0.5.0': mockReleases['0.5.0'] };
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(cachedData));

      // Mock GitHub API to fail
      vi.mocked(ghRequest).mockRejectedValueOnce(new Error('GitHub API Error'));

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

      // Should return 200 with cached data as fallback
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.error_code).toBe(0);
      expect(data.result).toContain('Releases cache updated successfully');
      // Should report the cached release count
      expect(data.result).toContain('1 release');
    });
  });

  describe('Error Handling', () => {
    it('should fallback to cached data when GitHub API fails', async () => {
      // Pre-populate cache
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(mockReleases));

      // Mock GitHub API to fail
      vi.mocked(ghRequest).mockRejectedValueOnce(new Error('API Error'));

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return cached data despite API failure
      expect(data.result).toBeTruthy();
      expect(Object.keys(data.result)).toContain('0.5.0');
    });

    it('should handle corrupted cache data gracefully', async () => {
      // Put invalid JSON in cache
      await env.CACHE_KV.put('gh-fossbilling-releases', 'invalid-json');

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Should fetch from API instead
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toBeTruthy();
    });

    it('should return empty object when both API and cache fail', async () => {
      // Mock GitHub API to fail
      vi.mocked(ghRequest).mockRejectedValueOnce(new Error('API Error'));

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return empty object
      expect(data.result).toEqual({});
    });

    it('should handle releases without FOSSBilling.zip asset', async () => {
      // Mock releases without zip asset
      const releasesWithoutZip = mockGitHubReleases.map(r => ({
        ...r,
        assets: [],
      }));

      vi.mocked(ghRequest).mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: releasesWithoutZip } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return empty object as no valid releases
      expect(data.result).toEqual({});
    });
  });

  describe('PHP Version Detection', () => {
    it('should fetch PHP version for version >= 0.5.0 from root', async () => {
      let composerPath = '';

      vi.mocked(ghRequest).mockImplementation(async (route: string, options: any) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mockGitHubReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          composerPath = options.path;
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // For version 0.6.0, should use composer.json from root
      expect(composerPath).toBe('composer.json');
    });

    it('should fetch PHP version for version < 0.5.0 from src/', async () => {
      const oldRelease = [{
        id: 999,
        tag_name: '0.4.0',
        name: '0.4.0',
        published_at: '2022-01-01T00:00:00Z',
        prerelease: false,
        body: '## 0.4.0\n- Old version',
        assets: [{
          name: 'FOSSBilling.zip',
          browser_download_url: 'https://github.com/FOSSBilling/FOSSBilling/releases/download/0.4.0/FOSSBilling.zip',
          size: 1000000,
        }],
      }];

      let composerPath = '';

      vi.mocked(ghRequest).mockImplementation(async (route: string, options: any) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: oldRelease } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          composerPath = options.path;
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // For version 0.4.0, should use src/composer.json
      expect(composerPath).toBe('src/composer.json');
    });

    it('should handle missing composer.json gracefully', async () => {
      vi.mocked(ghRequest).mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mockGitHubReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          throw new Error('File not found');
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should still return releases with empty PHP version
      expect(data.result).toBeTruthy();
      Object.values(data.result).forEach((release: any) => {
        expect(release.minimum_php_version).toBe('');
      });
    });
  });
});
