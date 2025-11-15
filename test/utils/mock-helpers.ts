/**
 * Test Mock Helpers
 *
 * Utilities for setting up and cleaning up mocks in tests
 *
 * @license AGPL-3.0
 */

import { vi } from 'vitest';

/**
 * Suppress console output during tests
 * Returns a cleanup function to restore console
 */
export function suppressConsole() {
  const originalError = console.error;
  const originalLog = console.log;
  const originalWarn = console.warn;

  console.error = vi.fn();
  console.log = vi.fn();
  console.warn = vi.fn();

  return () => {
    console.error = originalError;
    console.log = originalLog;
    console.warn = originalWarn;
  };
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
  };
}

/**
 * Setup GitHub API mock with standard responses
 */
export function setupGitHubApiMock(
  ghRequest: any,
  githubReleases: any[],
  composerJson: any
) {
  ghRequest.mockImplementation(async (route: string) => {
    if (route === 'GET /repos/{owner}/{repo}/releases') {
      return { data: githubReleases };
    }
    if (route === 'GET /repos/{owner}/{repo}/contents/{path}{?ref}') {
      const content = btoa(JSON.stringify(composerJson));
      return {
        data: {
          content: content,
        },
      };
    }
    throw new Error('Unexpected route');
  });
}
