import { bearerAuth } from "hono/bearer-auth";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { prettyJSON } from "hono/pretty-json";
import { request as ghRequest } from "@octokit/request";
import { trimTrailingSlash } from "hono/trailing-slash";
import {
  compare as semverCompare,
  gt as semverGt,
  gte as semverGte,
  valid as semverValid
} from "semver";
import { Releases, ReleaseDetails } from "./interfaces";
import { getPlatform } from "../../../lib/middleware";
import { ICache } from "../../../lib/interfaces";
import { logError, logWarn, logInfo } from "../../../lib/logger";
import {
  GitHubError,
  AuthError,
  RateLimitError,
  NetworkError,
  ValidationError,
  classifyGitHubError,
  getMostCriticalError
} from "../../../lib/github-errors";

// Cache for UPDATE_TOKEN to avoid repeated KV lookups
let updateTokenCache: string | null = null;

const versionsV1 = new Hono<{ Bindings: CloudflareBindings }>();

versionsV1.use(
  "/*",
  cors({
    origin: "*"
  }),
  trimTrailingSlash()
);

async function getUpdateToken(cache: ICache): Promise<string> {
  if (updateTokenCache) {
    return updateTokenCache;
  }

  const token = await cache.get("UPDATE_TOKEN");

  if (!token) {
    throw new Error("UPDATE_TOKEN not found in AUTH_KV storage");
  }

  updateTokenCache = token;

  return token;
}

versionsV1.get(
  "/",
  cache({
    cacheName: "versions-api-v1",
    cacheControl: "max-age: 86400"
  }),
  etag(),
  prettyJSON(),
  async (c) => {
    const platform = getPlatform(c);
    const result = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

    const releases = result.releases;

    if (Object.keys(releases).length === 0 && result.error) {
      return c.json(
        {
          result: null,
          error_code: 503,
          message: "Unable to fetch releases and no cached data available",
          details: {
            http_status: result.error.httpStatus,
            error_code: result.error.errorCode
          }
        },
        503
      );
    }

    if (Object.keys(releases).length === 0) {
      c.header("Vary", "*");
    }

    return c.json({
      result: releases,
      error_code: 0,
      message: null,
      stale: result.source === "stale"
    });
  }
);

versionsV1.get(
  "/update",
  async (c, next) => {
    const platform = getPlatform(c);
    const token = await getUpdateToken(platform.getCache("AUTH_KV"));
    const bearer = bearerAuth({ token });
    return bearer(c, next);
  },
  async (c) => {
    const platform = getPlatform(c);
    const result = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      true
    );
    const releaseCount = Object.keys(result.releases).length;

    if (result.error && releaseCount === 0) {
      return c.json(
        {
          result: null,
          error_code: 500,
          message: `Failed to fetch releases: ${result.error.message}`,
          details: {
            http_status: result.error.httpStatus,
            error_code: result.error.errorCode
          },
          stale: result.source === "stale"
        },
        500
      );
    }

    if (result.error) {
      return c.json({
        result: `Releases cache updated with ${releaseCount} releases (some errors occurred).`,
        error_code: 0,
        message: result.error.message,
        warning: result.error.message,
        details: {
          http_status: result.error.httpStatus,
          error_code: result.error.errorCode
        },
        stale: result.source === "stale"
      });
    }

    return c.json({
      result: `Releases cache updated successfully with ${releaseCount} releases.`,
      error_code: 0,
      message: null,
      warning: null,
      stale: false
    });
  }
);

versionsV1.get(
  "/build_changelog/:current",
  cache({ cacheName: "versions-api-v1", cacheControl: "max-age: 86400" }),
  etag(),
  prettyJSON(),
  async (c) => {
    const current = c.req.param("current");
    const platform = getPlatform(c);
    const result = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

    const releases = result.releases;

    if (Object.keys(releases).length === 0 && result.error) {
      return c.json(
        {
          result: null,
          error_code: 503,
          message: "Unable to fetch releases and no cached data available",
          details: {
            http_status: result.error.httpStatus,
            error_code: result.error.errorCode
          }
        },
        503
      );
    }

    if (!semverValid(current)) {
      c.status(400);
      return c.json({
        result: null,
        error_code: 400,
        message: `'${current}' is not a valid semantic version.`
      });
    }

    const sortedReleaseKeys = Object.keys(releases).sort((a, b) =>
      semverCompare(b, a)
    );
    const completedChangelog: string[] = [];

    for (const version of sortedReleaseKeys) {
      if (semverGt(version, current)) {
        let changelog = releases[version].changelog;

        if (!changelog) {
          changelog = `## ${version}\n`;
          changelog += "The changelogs for this release appear to be missing.";
        }

        completedChangelog.push(changelog);
      } else {
        break;
      }
    }

    const assembledChangelog = completedChangelog.join("\n");

    return c.json({
      result: assembledChangelog,
      error_code: 0,
      message: null,
      stale: result.source === "stale"
    });
  }
);

versionsV1.get(
  "/:version",
  cache({ cacheName: "versions-api-v1", cacheControl: "max-age: 86400" }),
  etag(),
  prettyJSON(),
  async (c) => {
    const version = c.req.param("version");
    const platform = getPlatform(c);
    let result = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

    let releases = result.releases;

    if (Object.keys(releases).length === 0) {
      result = await getReleases(
        platform.getCache("CACHE_KV"),
        platform.getEnv("GITHUB_TOKEN") || "",
        true
      );
      releases = result.releases;
    }

    if (Object.keys(releases).length === 0 && result.error) {
      return c.json(
        {
          result: null,
          error_code: 503,
          message: "Unable to fetch releases and no cached data available",
          details: {
            http_status: result.error.httpStatus,
            error_code: result.error.errorCode
          }
        },
        503
      );
    }

    if (Object.keys(releases).length === 0) {
      c.status(404);
      return c.json({
        result: null,
        error_code: 404,
        message:
          "No releases are currently available. Please try again later or check the GitHub releases page."
      });
    }

    if (version === "latest") {
      const sortedKeys = Object.keys(releases).sort(semverCompare);
      const lastKey = sortedKeys.at(-1);

      return c.json({
        result: lastKey ? releases[lastKey] : null,
        error_code: 0,
        message: null,
        stale: result.source === "stale"
      });
    } else if (version in releases) {
      return c.json({
        result: releases[version],
        error_code: 0,
        message: null,
        stale: result.source === "stale"
      });
    } else {
      c.status(404);
      return c.json({
        result: null,
        error_code: 404,
        message: `FOSSBilling version ${version} does not appear to exist.`
      });
    }
  }
);

export default versionsV1;

interface GetReleasesResult {
  releases: Releases;
  source: "cache" | "fresh" | "stale";
  error?: GitHubError;
}

export async function getReleases(
  cache: ICache,
  githubToken: string,
  updateCache: boolean = false
): Promise<GetReleasesResult> {
  const cachedReleases = await cache.get("gh-fossbilling-releases");
  const cacheTTL = 86400;

  if (cachedReleases && !updateCache) {
    try {
      const parsedCache = JSON.parse(cachedReleases);
      if (parsedCache && typeof parsedCache === "object") {
        logInfo("versions", "Serving releases from cache", {
          cacheKey: "gh-fossbilling-releases"
        });
        return {
          releases: parsedCache,
          source: "cache"
        };
      }
    } catch (parseError) {
      logError(
        "versions",
        "Cache corruption detected, attempting fresh fetch",
        {
          cacheKey: "gh-fossbilling-releases",
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
        }
      );
    }
  }

  try {
    const result = await ghRequest("GET /repos/{owner}/{repo}/releases", {
      owner: "FOSSBilling",
      repo: "FOSSBilling",
      headers: {
        Authorization: `Bearer ${githubToken}`
      },
      per_page: 100
    });

    if (!Array.isArray(result.data)) {
      logWarn("versions", "Unexpected GitHub releases response format", {
        responseType: typeof result.data
      });
      return {
        releases: {},
        source: "fresh"
      };
    }

    logInfo("versions", "Successfully fetched releases from GitHub API", {
      url: "https://api.github.com/repos/FOSSBilling/FOSSBilling/releases",
      releaseCount: result.data.length
    });

    let releases: Releases = {};
    const errors: GitHubError[] = [];

    const releasePromises = result.data.map(
      async (release): Promise<[string, ReleaseDetails] | null> => {
        const tag = release.tag_name;
        if (!semverValid(tag)) {
          logWarn("versions", "Skipping release with invalid semver tag", {
            tag,
            releaseId: release.id
          });
          return null;
        }

        const zipAsset = release.assets.find(
          (asset) => asset.name === "FOSSBilling.zip"
        );
        if (!zipAsset) {
          return null;
        }

        const phpResult = await getReleaseMinPhpVersion(githubToken, tag);

        if (phpResult.error) {
          errors.push(phpResult.error);
        }

        const releaseDetails: ReleaseDetails = {
          version: release.name || tag,
          released_on: release.published_at ?? "",
          minimum_php_version: phpResult.version,
          download_url: zipAsset.browser_download_url,
          size_bytes: zipAsset.size,
          is_prerelease: Boolean(release.prerelease),
          github_release_id: release.id ?? 0,
          changelog: release.body || ""
        };
        return [tag, releaseDetails];
      }
    );

    const releaseEntries = (await Promise.all(releasePromises)).filter(
      (entry): entry is [string, ReleaseDetails] => entry !== null
    );

    const sortedReleases = Object.fromEntries(
      releaseEntries.sort((a, b) => semverCompare(a[0], b[0]))
    );
    releases = sortedReleases;

    if (Object.keys(releases).length > 0) {
      await cache.put("gh-fossbilling-releases", JSON.stringify(releases), {
        expirationTtl: cacheTTL
      });
      logInfo("versions", "Updated releases cache", {
        cacheKey: "gh-fossbilling-releases",
        releaseCount: Object.keys(releases).length
      });
    }

    const mostCriticalError = getMostCriticalError(errors) || undefined;

    return {
      releases,
      source: "fresh",
      error:
        mostCriticalError instanceof ValidationError
          ? undefined
          : mostCriticalError
    };
  } catch (error) {
    const githubError = classifyGitHubError(
      error,
      "https://api.github.com/repos/FOSSBilling/FOSSBilling/releases"
    );

    if (githubError instanceof ValidationError) {
      logWarn("versions", "Invalid response received from GitHub API", {
        message: githubError.message,
        url: githubError.url
      });
      return {
        releases: {},
        source: "fresh"
      };
    }

    if (
      githubError instanceof AuthError ||
      githubError instanceof RateLimitError
    ) {
      logError("versions", "Critical GitHub API error", {
        message: githubError.message,
        httpStatus: githubError.httpStatus,
        url: githubError.url
      });
    } else {
      logWarn("versions", "GitHub API error", {
        message: githubError.message,
        httpStatus: githubError.httpStatus,
        url: githubError.url
      });
    }

    if (cachedReleases) {
      try {
        const parsedCache = JSON.parse(cachedReleases);
        logInfo("versions", "Serving stale releases from cache", {
          cacheKey: "gh-fossbilling-releases",
          reason: githubError.message
        });
        return {
          releases: parsedCache,
          source: "stale",
          error: githubError
        };
      } catch (parseError) {
        logError("versions", "Cache corruption detected", {
          cacheKey: "gh-fossbilling-releases",
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
        });
        return {
          releases: {},
          source: "fresh",
          error: githubError
        };
      }
    }

    return {
      releases: {},
      source: "fresh",
      error: githubError
    };
  }
}

interface GetReleaseMinPhpVersionResult {
  version: string;
  error?: GitHubError;
}

export async function getReleaseMinPhpVersion(
  githubToken: string,
  version: string
): Promise<GetReleaseMinPhpVersionResult> {
  const composerPath = semverGte(version, "0.5.0")
    ? "composer.json"
    : "src/composer.json";
  const url = `https://api.github.com/repos/FOSSBilling/FOSSBilling/contents/${composerPath}?ref=${version}`;

  try {
    const result = await ghRequest(
      "GET /repos/{owner}/{repo}/contents/{path}{?ref}",
      {
        owner: "FOSSBilling",
        repo: "FOSSBilling",
        path: composerPath,
        ref: version,
        headers: {
          Authorization: `Bearer ${githubToken}`
        }
      }
    );

    const contentValue = result.data?.content;
    if (typeof contentValue === "string" && contentValue) {
      const content = new TextDecoder("utf-8").decode(
        Uint8Array.from(atob(contentValue), (c) => c.charCodeAt(0))
      );
      const composerJson = JSON.parse(content);
      if (composerJson.require && composerJson.require.php) {
        return {
          version: composerJson.require.php
            .replace("^", "")
            .replace(">=", "")
            .trim()
        };
      }
    }
  } catch (error) {
    const githubError = classifyGitHubError(error, url);

    if (
      githubError instanceof RateLimitError ||
      githubError instanceof AuthError
    ) {
      logError("versions", "Critical GitHub API error fetching composer.json", {
        version,
        url,
        message: githubError.message,
        httpStatus: githubError.httpStatus
      });
    } else if (githubError instanceof NetworkError) {
      logWarn("versions", "Network error fetching composer.json", {
        version,
        url,
        message: githubError.message
      });
    } else {
      logInfo("versions", "Unable to fetch composer.json", {
        version,
        url,
        message: githubError.message
      });
    }

    return {
      version: "",
      error: githubError
    };
  }

  return {
    version: ""
  };
}
