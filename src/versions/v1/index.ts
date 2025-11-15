/**
 * FOSSBilling API Worker - Versions Service (v1)
 * 
 * This service provides endpoints to retrieve FOSSBilling release information
 * directly from the GitHub repository. It supports fetching all releases,
 * specific release details, and building changelogs for updates.
 * 
 * @license AGPL-3.0
 */

import { bearerAuth } from 'hono/bearer-auth'
import { Hono } from 'hono';
import { cache } from 'hono/cache'
import { cors } from 'hono/cors'
import { etag } from 'hono/etag'
import { getContext } from 'hono/context-storage'
import { prettyJSON } from 'hono/pretty-json'
import { request as ghRequest } from "@octokit/request";
import { trimTrailingSlash } from 'hono/trailing-slash'
import { compare as semverCompare, gt as semverGt, gte as semverGte, valid as semverValid,} from 'semver';
import { Releases, ReleaseDetails } from './interfaces';

const versionsV1 = new Hono<{ Bindings: CloudflareBindings }>();

/* 
 * Apply CORS and trailing slash middleware to all routes in this router.
 * CORS allows requests from any origin for public API access.
 */
versionsV1.use('/*', 
    cors({
        origin: '*',
    }), 
    trimTrailingSlash()
);

/**
 * Retrieve all FOSSBilling releases.
 *
 * Returns a JSON response containing all available FOSSBilling releases (in ascending order),
 * with caching enabled (24 hours) and ETag support for efficient client-side caching.
 *
 * @returns Promise<Response> JSON response with releases data, error code, and message.
 */
versionsV1.get('/', cache({cacheName: 'versions-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    c.status(200);

    return c.json({
        'result': await getReleases(),
        'error_code': 0,
        'message': null
    });
});

/**
 * Force update the releases cache.
 *
 * Requires a valid bearer token for authorization.
 * Returns a JSON response indicating success or failure of the cache update.
 *
 * NOTE: This route must be defined before /:version to avoid conflicts.
 *
 * @route GET /update
 * @returns Promise<Response> JSON response with result, error code, and message.
 */
versionsV1.get('/update',
    async (c, next) => {
        const bearer = bearerAuth({ token: c.env.UPDATE_TOKEN });
        return bearer(c, next);
    },
    async (c) => {
        try {
            // Force update the releases cache.
            const releases = await getReleases(true);

            const releaseCount = Object.keys(releases).length;

            c.status(200);
            return c.json({
                'result': `Releases cache updated successfully with ${releaseCount} releases.`,
                'error_code': 0,
                'message': null
            });
        } catch (error) {
            c.status(500);
            return c.json({
                'result': null,
                'error_code': 500,
                'message': 'Failed to update releases cache: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
);

/**
 * Retrieve changelog entries for all releases newer than the specified version.
 *
 * Returns a JSON response containing the combined changelog entries for all.
 * FOSSBilling releases that are newer than the provided version.
 *
 * NOTE: This route must be defined before /:version to avoid conflicts.
 *
 * @param string current The current version to compare against.
 *
 * @returns Promise<Response> JSON response with assembled changelog, error code, and message.
 */
versionsV1.get('/build_changelog/:current', cache({cacheName: 'versions-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    const current = c.req.param('current');
    const releases = await getReleases();

    // Validate that 'current' is a valid semver string.
    if (!semverValid(current)) {
        c.status(400);
        return c.json({
            'result': null,
            'error_code': 400,
            'message': `'${current}' is not a valid semantic version.`
        });
    }

    // Sort release keys in descending order (newest first) using semverCompare
    const sortedReleaseKeys = Object.keys(releases).sort((a, b) => semverCompare(b, a));

    // Collect changelogs for versions greater than 'current'.
    let completedChangelog: string[] = [];
    for (const version of sortedReleaseKeys) {
        if (semverGt(version, current)) {
            let changelog = releases[version].changelog;

            // Handle missing changelog
            if (!changelog) {
                changelog = `## ${version}\n`;
                changelog += "The changelogs for this release appear to be missing.";
            }

            completedChangelog.push(changelog);
        } else {
            break;
        }
    }

    // Assemble changelog as single string.
    const assembledChangelog = completedChangelog.join('\n');

    c.status(200);
    return c.json({
        'result': assembledChangelog,
        'error_code': 0,
        'message': null
    });
});

/**
 * Retrieve a specific FOSSBilling release by version.
 *
 * Returns a JSON response containing details for a specific FOSSBilling release.
 * Supports 'latest' parameter to get the most recent release, or a specific version tag.
 * Includes caching (24 hours) and ETag support for efficient client-side caching.
 *
 * NOTE: This route uses a parameter and must be defined AFTER specific routes like /update and /build_changelog.
 *
 * @param string version The version tag or 'latest'.
 *
 * @returns Promise<Response> JSON response with release data, error code, and message (404 if version not found).
 */
versionsV1.get('/:version', cache({cacheName: 'versions-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    const version = c.req.param('version');
    const releases = await getReleases();

    // Handle case where no releases are available.
    if (Object.keys(releases).length === 0) {
        c.status(500);
        return c.json({
            'result': null,
            'error_code': 500,
            'message': 'Could not retrieve release information.'
        });
    }

    // If 'latest' is requested, return the latest release (last in ascending sorted order).
    if (version === 'latest') {
        c.status(200);

        return c.json({
            // Get the sorted keys and safely access the last element.
            'result': (() => {
                const sortedKeys = Object.keys(releases).sort(semverCompare);
                const lastKey = sortedKeys.at(-1);
                return lastKey ? releases[lastKey] : null;
            })(),
            'error_code': 0,
            'message': null
        });
    }
    // If specific version exists, return its details.
    else if (version in releases) {
        c.status(200);

        return c.json({
            'result': releases[version],
            'error_code': 0,
            'message': null
        });
    }
    // If version not found, return 404 error.
    else {
        c.status(404);

        return c.json({
            'result': null,
            'error_code': 404,
            'message': `FOSSBilling version ${version} does not appear to exist.`
        });
    }
});

export default versionsV1;

/*
 * Get all releases from cache or GitHub API.
 *
 * @param updateCache boolean Whether to force update the cache.
 * 
 * @return Promise<Releases> The releases data (in ascending order).
 */
async function getReleases(updateCache: boolean = false): Promise<Releases> {
    // Get Hono Context to access environment variables.
    const c = getContext<{ Bindings: CloudflareBindings }>();

    // Try to get releases from cache first.
    const cachedReleases = await c.env.CACHE_KV.get('gh-fossbilling-releases');
    const cacheTTL = 86400; // 24 hours

    // If cache valid and not forcing update, return cached data
    if (cachedReleases && !updateCache) {
        try {
            return JSON.parse(cachedReleases);
        } catch (error) {
            console.error("Failed to parse cached releases data:", error);
            // Continue to fetch fresh data if parse fails
        }
    }

    // Fetch from GitHub API if cache is invalid or update is requested
    try {
        // Fetch releases from GitHub API.
        const result = await ghRequest('GET /repos/{owner}/{repo}/releases', {
            owner: 'FOSSBilling',
            repo: 'FOSSBilling',
            headers: {
                'Authorization': `Bearer ${c.env.GITHUB_TOKEN}`,
            },
            per_page: 100 // Ensure we get all releases
        });

        // Transform the data to match our Releases type.
        let releases: Releases = {};
        if (result.data && Array.isArray(result.data)) {
            const releasePromises = result.data.map(async (release): Promise<[string, ReleaseDetails] | null> => {
                const zipAsset = release.assets.find(asset => asset.name === 'FOSSBilling.zip');
                if (!zipAsset) {
                    return null;
                }
                const phpVersion = await getReleaseMinPhpVersion(release.tag_name);

                const releaseDetails: ReleaseDetails = {
                    version: release.name || release.tag_name,
                    released_on: release.published_at!,
                    minimum_php_version: phpVersion,
                    download_url: zipAsset.browser_download_url,
                    size_bytes: zipAsset.size,
                    is_prerelease: release.prerelease,
                    github_release_id: release.id,
                    changelog: release.body || '',
                };
                return [release.tag_name, releaseDetails];
            });

            const releaseEntries = (await Promise.all(releasePromises)).filter((entry): entry is [string, ReleaseDetails] => entry !== null);
            // Use semverCompare for consistent sorting - sort in ascending order as per function documentation
            const sortedReleases = Object.fromEntries(releaseEntries.sort((a, b) => semverCompare(a[0], b[0])));
            releases = sortedReleases;
        }

        if (Object.keys(releases).length > 0) {
            // Store in cache for 24 hours.
            await c.env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(releases), { expirationTtl: cacheTTL });
        }
        
        return releases;
    } catch (error) {
        console.error("Failed to fetch releases from GitHub:", error);
        
        // If cache exists but is outdated, use it as fallback
        if (cachedReleases) {
            console.log("Using cached releases as fallback after API error");
            try {
                return JSON.parse(cachedReleases);
            } catch {
                // If parsing fails, return empty object
                return {};
            }
        }
        
        return {};
    }
}

/**
 * Get the minimum PHP version required for a specific release by reading its composer.json.
 *
 * @param version string The release tag/branch name.
 * 
 * @return Promise<string> The minimum PHP version or empty string on failure.
 */
export async function getReleaseMinPhpVersion(version: string): Promise<string> {
    // Get Hono Context to access environment variables.
    const c = getContext<{ Bindings: CloudflareBindings }>();
    
    // Determine the correct path to composer.json based on version.
    const composerPath = semverGte(version, '0.5.0') ? 'composer.json' : 'src/composer.json';

    try {
        // Fetch the composer.json file from the specific tag/branch.
        const result = await ghRequest('GET /repos/{owner}/{repo}/contents/{path}{?ref}', {
            owner: 'FOSSBilling',
            repo: 'FOSSBilling',
            path: composerPath,
            ref: version,
            headers: {
                'Authorization': `Bearer ${c.env.GITHUB_TOKEN}`,
            }
        });

        // Decode base64 content and parse JSON to get PHP version requirement.
        if (result.data && 'content' in result.data && result.data.content) {
            const content = new TextDecoder('utf-8').decode(Uint8Array.from(atob(result.data.content), c => c.charCodeAt(0)));
            const composerJson = JSON.parse(content);
            if (composerJson.require && composerJson.require.php) {
                return composerJson.require.php.replace('^', '').replace('>=', '').trim();
            }
        }

        return '';
    } catch (error) {
        console.error(`Error fetching PHP version for release ${version}:`, error);
        return '';
    }
}