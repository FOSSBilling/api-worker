/**
 * Release API - v1
 * 
 * This module defines the Release API.
 * It provides an endpoint to retrieve a list of FOSSBilling releases
 * along with their support status.
 * 
 * NOTE: This endpoint is deprecated and will be removed (after 31-Dec-2025).
 * 
 * @license AGPL-3.0
 */

import { Hono } from 'hono';
import { cache } from 'hono/cache'
import { cors } from 'hono/cors'
import { etag } from 'hono/etag'
import { prettyJSON } from 'hono/pretty-json'
import { trimTrailingSlash } from 'hono/trailing-slash'
import { diff as semverDiff } from 'semver';
import { FOSSBillingVersion } from "./interfaces";

const releasesV1 = new Hono<{ Bindings: CloudflareBindings, strict: true }>();

/* 
 * Apply CORS and trailing slash middleware to all routes in this router.
 * CORS allows requests from any origin for public API access.
 */
releasesV1.use('/*', 
    cors({
        origin: '*',
    }), 
    trimTrailingSlash()
);

/**
 * Retrieves the list of FOSSBilling versions along with their support status.
 * 
 * Support status can be:
 * - 'latest': The most recent version.
 * - 'outdated': A version that is not the latest but still receives security updates.
 * - 'insecure': A version that no longer receives security updates.
 * 
 * NOTE: This endpoint is deprecated and will be removed (after 31-Dec-2025).
 * 
 * @returns {Object} An object containing an array of versions with their support status.
 */
releasesV1.get('/', cache({cacheName: 'releases-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    const baseUrl = new URL(c.req.url).origin;
    let releases: { result: unknown } = { result: [] };
    try {
        const response = await fetch(`${baseUrl}/versions/v1`);
        if (!response.ok) {
            throw new Error(`Failed to fetch versions: ${response.statusText}.`);
        }
        releases = await response.json();
    } catch (error) {
        return c.json({ result: null, error: 'Failed to fetch or parse versions.' }, 500);
    }
    
    const rawVersions = Array.isArray(releases.result) ? releases.result.flat().filter(Boolean) : Object.keys((releases.result as Record<string, unknown>) || {});
    const latestVersion = rawVersions[rawVersions.length - 1];
    const versions: FOSSBillingVersion[] = rawVersions.map((version) => {
        const versionStr = String(version);
        
        if (versionStr === latestVersion) {
            return { version: versionStr, support: 'latest' };
        }
        
        const support = (semverDiff(versionStr, latestVersion) === 'patch') ? 'outdated' : 'insecure';
        
        return { version: versionStr, support };
    });

    // Set deprecation and sunset headers.
    c.header('Deprecation', '@1735689599'); // 31-Dec-2024 23:59:59 UTC
    c.header('Sunset', 'Wed, 31 Dec 2025 23:59:59 UTC');

    c.status(200);
    return c.json({ result: { versions }, error: null });
});

export default releasesV1;