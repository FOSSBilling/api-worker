import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import app from '../../../../src';
import { mockReleases } from '../../../fixtures/releases';
import { mockGitHubReleases, mockComposerJson } from '../../../fixtures/github-releases';
import { suppressConsole, setupGitHubApiMock } from '../../../utils/mock-helpers';

vi.mock('@octokit/request', () => ({
  request: vi.fn(),
}));

import { request as ghRequest } from '@octokit/request';

let restoreConsole: (() => void) | null = null;
let originalKVPut: typeof env.CACHE_KV.put | null = null;

describe('Versions API v1', () => {
  beforeEach(async () => {
    restoreConsole = suppressConsole();
    await env.CACHE_KV.delete('gh-fossbilling-releases');
    vi.clearAllMocks();
    setupGitHubApiMock(vi.mocked(ghRequest), mockGitHubReleases, mockComposerJson);
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

      const cached = await env.CACHE_KV.get('gh-fossbilling-releases');
      expect(cached).toBeTruthy();

      const cachedData = JSON.parse(cached!);
      expect(Object.keys(cachedData).length).toBeGreaterThan(0);
    });

    it('should use cached data on subsequent requests', async () => {
      const ctx1 = createExecutionContext();
      await app.request('/versions/v1', {}, env, ctx1);
      await waitOnExecutionContext(ctx1);

      const firstCallCount = vi.mocked(ghRequest).mock.calls.length;

      const ctx2 = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx2);
      await waitOnExecutionContext(ctx2);

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
      expect(data.result).toContain('0.6.0');
      expect(data.result).toContain('0.5.2');
      expect(data.result).toContain('0.5.1');
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

      expect(data.result).toBe('');
    });
  });

  describe('GET /update', () => {
    it('should update cache with valid bearer token', async () => {
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
      const cachedData = { '0.5.0': mockReleases['0.5.0'] };
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(cachedData));

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

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.error_code).toBe(0);
      expect(data.result).toContain('Releases cache updated successfully');
      expect(data.result).toContain('1 release');
    });

    it('should handle cache update failure when KV put fails', async () => {
      originalKVPut = env.CACHE_KV.put;
      
      let putCallCount = 0;
      env.CACHE_KV.put = vi.fn().mockImplementation(async (key, value, options) => {
        putCallCount++;
        if (putCallCount === 1) {
          throw new Error('KV storage error');
        }
        return originalKVPut!(key, value, options);
      });

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

      if (response.status === 500) {
        const data = await response.json();
        expect(data.error_code).toBe(500);
        expect(data.message).toContain('Failed to update releases cache');
      } else {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.result).toContain('Releases cache updated successfully');
      }
    });

    it('should handle concurrent cache updates gracefully', async () => {
      let cacheGetCount = 0;
      let cachePutCount = 0;
      const originalGet = env.CACHE_KV.get;
      const originalPut = env.CACHE_KV.put;

      env.CACHE_KV.get = vi.fn().mockImplementation(async () => {
        cacheGetCount++;
        return originalGet.call(env.CACHE_KV, 'gh-fossbilling-releases');
      });

      env.CACHE_KV.put = vi.fn().mockImplementation(async (key, value) => {
        cachePutCount++;
        return originalPut.call(env.CACHE_KV, key, value);
      });

      const ctx1 = createExecutionContext();
      const ctx2 = createExecutionContext();
      
      const promise1 = app.request(
        '/versions/v1/update',
        {
          headers: {
            Authorization: `Bearer ${env.UPDATE_TOKEN}`,
          },
        },
        env,
        ctx1
      );

      const promise2 = app.request(
        '/versions/v1/update',
        {
          headers: {
            Authorization: `Bearer ${env.UPDATE_TOKEN}`,
          },
        },
        env,
        ctx2
      );

      const [response1, response2] = await Promise.all([promise1, promise2]);
      await waitOnExecutionContext(ctx1);
      await waitOnExecutionContext(ctx2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.error_code).toBe(0);
      expect(data2.error_code).toBe(0);

      env.CACHE_KV.get = originalGet;
      env.CACHE_KV.put = originalPut;
    });




  });

  describe('Error Handling', () => {
    it('should handle GitHub API rate limiting (429) gracefully', async () => {
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(mockReleases));

      const rateLimitError = new Error('API rate limit exceeded');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).documentation_url = 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting';
      vi.mocked(ghRequest).mockRejectedValueOnce(rateLimitError);

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toEqual(mockReleases);
    });

    it('should handle GitHub API authentication failures (401) gracefully', async () => {
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(mockReleases));

      const authError = new Error('Bad credentials');
      (authError as any).status = 401;
      (authError as any).documentation_url = 'https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication';
      vi.mocked(ghRequest).mockRejectedValueOnce(authError);

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toEqual(mockReleases);
    });

    it('should handle network timeout scenarios', async () => {
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(mockReleases));

      vi.mocked(ghRequest).mockImplementationOnce(async () => {
        const error = new Error('Network timeout');
        (error as any).code = 'ETIMEDOUT';
        throw error;
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toEqual(mockReleases);
    });

    it('should fallback to cached data when GitHub API fails', async () => {
      await env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(mockReleases));

      vi.mocked(ghRequest).mockRejectedValueOnce(new Error('API Error'));

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toBeTruthy();
      expect(Object.keys(data.result)).toContain('0.5.0');
      expect(data.result['0.5.0'].version).toBe('0.5.0');
    });

    it('should handle corrupted cache data gracefully', async () => {
      await env.CACHE_KV.put('gh-fossbilling-releases', 'invalid-json');

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.result).toBeTruthy();
    });

    it('should return empty object when both API and cache fail', async () => {
      vi.mocked(ghRequest).mockRejectedValueOnce(new Error('API Error'));

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toEqual({});
    });

    it('should handle releases without FOSSBilling.zip asset', async () => {
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

      expect(data.result).toEqual({});
    });

    it('should handle mixed releases with and without FOSSBilling.zip asset', async () => {
      const mixedReleases = [
        mockGitHubReleases[0], // Has zip asset
        {
          ...mockGitHubReleases[1],
          assets: [], // No zip asset
        },
        mockGitHubReleases[2], // Has zip asset
      ];

      vi.mocked(ghRequest).mockReset();
      vi.mocked(ghRequest).mockImplementation(async (route: string, options?: any) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mixedReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      await env.CACHE_KV.delete('gh-fossbilling-releases');

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only include releases with zip assets
      expect(Object.keys(data.result)).toHaveLength(2);
      expect(data.result).toHaveProperty(mockGitHubReleases[0].tag_name);
      expect(data.result).toHaveProperty(mockGitHubReleases[2].tag_name);
      expect(data.result).not.toHaveProperty(mockGitHubReleases[1].tag_name);
    });
  });

  describe('PHP Version Detection', () => {
    it('should fetch PHP version for version >= 0.5.0 from root', async () => {
      await env.CACHE_KV.delete('gh-fossbilling-releases');
      
      let composerPath = '';

      vi.mocked(ghRequest).mockReset();
      vi.mocked(ghRequest).mockImplementation(async (route: string, options?: any) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mockGitHubReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          composerPath = options?.path || '';
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const releases = data.result;
      
      const hasPhpVersions = Object.values(releases).some((release: any) => 
        release.minimum_php_version && release.minimum_php_version !== ''
      );
      
      expect(hasPhpVersions).toBe(true);
      expect(composerPath).toBe('composer.json');
    });

    it('should fetch PHP version for version < 0.5.0 from src/', async () => {
      await env.CACHE_KV.delete('gh-fossbilling-releases');
      
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

      vi.mocked(ghRequest).mockReset();
      vi.mocked(ghRequest).mockImplementation(async (route: string, options?: any) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: oldRelease } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          composerPath = options?.path || '';
          const content = btoa(JSON.stringify(mockComposerJson));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const releases = data.result;
      
      const hasPhpVersions = Object.values(releases).some((release: any) => 
        release.minimum_php_version && release.minimum_php_version !== ''
      );
      
      expect(hasPhpVersions).toBe(true);
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

      expect(data.result).toBeTruthy();
      Object.values(data.result).forEach((release: any) => {
        expect(release.minimum_php_version).toBe('');
      });
    });

    it('should handle invalid base64 content in composer.json gracefully', async () => {
      vi.mocked(ghRequest).mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mockGitHubReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          return { data: { content: 'invalid-base64!!!' } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toBeTruthy();
      Object.values(data.result).forEach((release: any) => {
        expect(release.minimum_php_version).toBe('');
      });
    });

    it('should handle malformed JSON in composer.json gracefully', async () => {
      vi.mocked(ghRequest).mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mockGitHubReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          const malformedJson = btoa('{ invalid json content }');
          return { data: { content: malformedJson } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toBeTruthy();
      Object.values(data.result).forEach((release: any) => {
        expect(release.minimum_php_version).toBe('');
      });
    });

    it('should handle composer.json without require.php field', async () => {
      vi.mocked(ghRequest).mockImplementation(async (route: string) => {
        if (route === 'GET /repos/{owner}/{repo}/releases') {
          return { data: mockGitHubReleases } as any;
        }
        if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
          const composerWithoutPhp = {
            name: 'fossbilling/fossbilling',
            require: {
              'php': '',
              'other/package': '^1.0'
            }
          };
          const content = btoa(JSON.stringify(composerWithoutPhp));
          return { data: { content } } as any;
        }
        throw new Error('Unexpected route');
      });

      const ctx = createExecutionContext();
      const response = await app.request('/versions/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result).toBeTruthy();
      Object.values(data.result).forEach((release: any) => {
        expect(release.minimum_php_version).toBe('');
      });
    });
  });
});
