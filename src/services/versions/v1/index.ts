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
    const releases = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

    if (Object.keys(releases).length === 0) {
      c.header("Vary", "*");
    }

    return c.json({
      result: releases,
      error_code: 0,
      message: null
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
    const releases = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      true
    );
    const releaseCount = Object.keys(releases).length;

    return c.json({
      result: `Releases cache updated successfully with ${releaseCount} releases.`,
      error_code: 0,
      message: null
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
    const releases = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

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
      message: null
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
    let releases = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

    if (Object.keys(releases).length === 0) {
      releases = await getReleases(
        platform.getCache("CACHE_KV"),
        platform.getEnv("GITHUB_TOKEN") || "",
        true
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
        message: null
      });
    } else if (version in releases) {
      return c.json({
        result: releases[version],
        error_code: 0,
        message: null
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

export async function getReleases(
  cache: ICache,
  githubToken: string,
  updateCache: boolean = false
): Promise<Releases> {
  const cachedReleases = await cache.get("gh-fossbilling-releases");
  const cacheTTL = 86400;

  if (cachedReleases && !updateCache) {
    return JSON.parse(cachedReleases);
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

    let releases: Releases = {};
    if (result.data && Array.isArray(result.data)) {
      const releasePromises = result.data.map(
        async (release): Promise<[string, ReleaseDetails] | null> => {
          const zipAsset = release.assets.find(
            (asset) => asset.name === "FOSSBilling.zip"
          );
          if (!zipAsset) {
            return null;
          }
          const phpVersion = await getReleaseMinPhpVersion(
            githubToken,
            release.tag_name
          );

          const releaseDetails: ReleaseDetails = {
            version: release.name || release.tag_name,
            released_on: release.published_at!,
            minimum_php_version: phpVersion,
            download_url: zipAsset.browser_download_url,
            size_bytes: zipAsset.size,
            is_prerelease: release.prerelease,
            github_release_id: release.id,
            changelog: release.body || ""
          };
          return [release.tag_name, releaseDetails];
        }
      );

      const releaseEntries = (await Promise.all(releasePromises)).filter(
        (entry): entry is [string, ReleaseDetails] => entry !== null
      );
      const sortedReleases = Object.fromEntries(
        releaseEntries.sort((a, b) => semverCompare(a[0], b[0]))
      );
      releases = sortedReleases;
    }

    if (Object.keys(releases).length > 0) {
      await cache.put("gh-fossbilling-releases", JSON.stringify(releases), {
        expirationTtl: cacheTTL
      });
    }

    return releases;
  } catch {
    if (cachedReleases) {
      return JSON.parse(cachedReleases);
    }
    return {};
  }
}

export async function getReleaseMinPhpVersion(
  githubToken: string,
  version: string
): Promise<string> {
  const composerPath = semverGte(version, "0.5.0")
    ? "composer.json"
    : "src/composer.json";

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

    if (result.data && "content" in result.data && result.data.content) {
      const content = new TextDecoder("utf-8").decode(
        Uint8Array.from(atob(result.data.content), (c) => c.charCodeAt(0))
      );
      const composerJson = JSON.parse(content);
      if (composerJson.require && composerJson.require.php) {
        return composerJson.require.php
          .replace("^", "")
          .replace(">=", "")
          .trim();
      }
    }
  } catch {
    // Ignore errors and return empty string
  }

  return "";
}
