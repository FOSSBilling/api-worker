/**
 * Tests for FOSSBilling API Worker - Releases Service (v1)
 *
 * NOTE: This is for the deprecated releases endpoint (sunset: 31-Dec-2025).
 *
 * @license AGPL-3.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import app from '../../../../src';
import { mockVersionsApiResponse } from '../../../fixtures/releases';
import { suppressConsole, createMockFetchResponse } from '../../../utils/mock-helpers';

// Console suppression cleanup function
let restoreConsole: (() => void) | null = null;
let fetchSpy: any = null;

describe('Releases API v1 (Deprecated)', () => {
  beforeEach(() => {
    // Suppress console output for cleaner test logs
    restoreConsole = suppressConsole();

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore console output
    if (restoreConsole) {
      restoreConsole();
      restoreConsole = null;
    }

    // Restore fetch spy if it exists
    if (fetchSpy) {
      fetchSpy.mockRestore();
      fetchSpy = null;
    }
  });

  describe('GET /', () => {
    it('should return releases with support status', async () => {
      // Mock the internal fetch to /versions/v1
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse(mockVersionsApiResponse) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('result');
      expect(data).toHaveProperty('error', null);
      expect(data.result).toHaveProperty('versions');
      expect(Array.isArray(data.result.versions)).toBe(true);
    });

    it('should set deprecation headers', async () => {
      // Mock the internal fetch
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({
          result: {
            '0.5.0': { version: '0.5.0' },
          },
        }) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('Deprecation')).toBeTruthy();
      expect(response.headers.get('Sunset')).toBeTruthy();
      expect(response.headers.get('Sunset')).toContain('31 Dec 2025');
    });

    it('should mark latest version correctly', async () => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({
          result: {
            '0.5.0': { version: '0.5.0' },
            '0.5.1': { version: '0.5.1' },
            '0.6.0': { version: '0.6.0' },
          },
        }) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      const versions = data.result.versions;
      const latestVersion = versions.find((v: any) => v.support === 'latest');

      expect(latestVersion).toBeTruthy();
      expect(latestVersion.version).toBe('0.6.0'); // Last version should be latest
    });

    it('should mark patch versions as outdated', async () => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({
          result: {
            '0.5.0': { version: '0.5.0' },
            '0.5.1': { version: '0.5.1' },
            '0.5.2': { version: '0.5.2' }, // Latest
          },
        }) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      const versions = data.result.versions;

      // 0.5.2 is latest
      const latest = versions.find((v: any) => v.version === '0.5.2');
      expect(latest.support).toBe('latest');

      // 0.5.1 and 0.5.0 should be outdated (same minor version)
      const v051 = versions.find((v: any) => v.version === '0.5.1');
      expect(v051.support).toBe('outdated');

      const v050 = versions.find((v: any) => v.version === '0.5.0');
      expect(v050.support).toBe('outdated');
    });

    it('should mark older minor/major versions as insecure', async () => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({
          result: {
            '0.4.0': { version: '0.4.0' },
            '0.5.0': { version: '0.5.0' },
            '0.6.0': { version: '0.6.0' }, // Latest
          },
        }) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      const versions = data.result.versions;

      // 0.6.0 is latest
      const latest = versions.find((v: any) => v.version === '0.6.0');
      expect(latest.support).toBe('latest');

      // 0.5.0 and 0.4.0 should be insecure (different minor version)
      const v050 = versions.find((v: any) => v.version === '0.5.0');
      expect(v050.support).toBe('insecure');

      const v040 = versions.find((v: any) => v.version === '0.4.0');
      expect(v040.support).toBe('insecure');
    });

    it('should include CORS headers', async () => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({
          result: { '0.5.0': { version: '0.5.0' } },
        }) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should handle fetch failure gracefully', async () => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({}, false) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.result).toBeNull();
      expect(data.error).toContain('Failed to fetch');
    });

    it('should handle JSON parse failure', async () => {
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as any);

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(500);
      const data = await response.json();

      expect(data.result).toBeNull();
      expect(data.error).toContain('Failed to fetch or parse versions');
    });

    it('should handle array response format from versions API', async () => {
      // Mock versions API returning array format (edge case)
      fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockFetchResponse({
          result: ['0.5.0', '0.5.1', '0.6.0'],
        }) as any
      );

      const ctx = createExecutionContext();
      const response = await app.request('/releases/v1', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.result.versions).toBeTruthy();
      expect(Array.isArray(data.result.versions)).toBe(true);
    });
  });
});
