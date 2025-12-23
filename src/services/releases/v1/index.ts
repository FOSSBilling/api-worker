import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { prettyJSON } from "hono/pretty-json";
import { trimTrailingSlash } from "hono/trailing-slash";
import { diff as semverDiff, compare as semverCompare } from "semver";
import { FOSSBillingVersion } from "./interfaces";
import { getReleases } from "../../versions/v1";
import { getPlatform } from "../../../lib/middleware";

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
    const platform = getPlatform(c);
    const releases = await getReleases(
      platform.getCache("CACHE_KV"),
      platform.getEnv("GITHUB_TOKEN") || "",
      false
    );

    const rawVersions = Object.keys(releases).sort(semverCompare);
    const latestVersion = rawVersions[rawVersions.length - 1];
    const versions: FOSSBillingVersion[] = rawVersions.map((version) => {
      const versionStr = String(version);

      if (versionStr === latestVersion) {
        return { version: versionStr, support: "latest" };
      }

      const support =
        semverDiff(versionStr, latestVersion) === "patch"
          ? "outdated"
          : "insecure";

      return { version: versionStr, support };
    });

    c.header("Deprecation", "true");
    c.header("Sunset", "Wed, 31 Dec 2025 23:59:59 UTC");
    c.header("Link", '</versions/v1>; rel="successor-version"');

    return c.json({ result: { versions }, error: null });
  }
);

export default releasesV1;
