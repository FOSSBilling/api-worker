import { vi } from "vitest";

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

export function createMockFetchResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error"
  };
}

export function setupGitHubApiMock(
  ghRequest: {
    mockImplementation: (fn: (route: string) => Promise<unknown>) => void;
  },
  githubReleases: unknown[],
  composerJson: Record<string, unknown>
) {
  ghRequest.mockImplementation(async (route: string) => {
    if (route === "GET /repos/{owner}/{repo}/releases") {
      return { data: githubReleases };
    }
    if (route === "GET /repos/{owner}/{repo}/contents/{path}{?ref}") {
      const content = btoa(JSON.stringify(composerJson));
      return {
        data: {
          content: content
        }
      };
    }
    throw new Error("Unexpected route");
  });
}
