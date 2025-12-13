import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { prettyJSON } from "hono/pretty-json";
import { trimTrailingSlash } from "hono/trailing-slash";
import { diff as semverDiff } from "semver";
import { FOSSBillingVersion } from "./interfaces";

const releasesV1 = new Hono<{ Bindings: CloudflareBindings; strict: true }>();

releasesV1.use(
  "/*",
  cors({
    origin: "*"
  }),
  trimTrailingSlash()
);

releasesV1.get(
  "/",
  cache({ cacheName: "releases-api-v1", cacheControl: "max-age: 86400" }),
  etag(),
  prettyJSON(),
  async (c) => {
    const baseUrl = new URL(c.req.url).origin;
    let releases: { result: unknown } = { result: [] };

    try {
      const response = await fetch(`${baseUrl}/versions/v1`);
      if (!response.ok) {
        return c.json({ result: null, error: "Failed to fetch versions" }, 500);
      }
      releases = await response.json();
    } catch {
      return c.json({ result: null, error: "Failed to fetch versions" }, 500);
    }

    const rawVersions = Array.isArray(releases.result)
      ? releases.result.flat().filter(Boolean)
      : Object.keys(releases.result || {});
    const latestVersion = rawVersions[rawVersions.length - 1];
    const versions: FOSSBillingVersion[] = rawVersions.map((version) => {
      const versionStr = String(version);

      if (versionStr === latestVersion) {
        return { version: versionStr, support: "supported" };
      }

      const support =
        semverDiff(versionStr, latestVersion) === "patch"
          ? "unsupported"
          : "supported";

      return { version: versionStr, support };
    });

    c.header("Deprecation", "true");
    c.header("Sunset", "Wed, 31 Dec 2025 23:59:59 UTC");
    c.header("Link", '</versions/v1>; rel="successor-version"');

    return c.json({ result: { versions }, error: null });
  }
);

export default releasesV1;
