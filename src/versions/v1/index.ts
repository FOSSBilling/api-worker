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

versionsV1.use('/*', 
    cors({
        origin: '*',
    }), 
    trimTrailingSlash()
);

versionsV1.get('/', cache({cacheName: 'versions-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    return c.json({
        'result': await getReleases(),
        'error_code': 0,
        'message': null
    });
});

versionsV1.get('/update',
    async (c, next) => {
        const bearer = bearerAuth({ token: c.env.UPDATE_TOKEN });
        return bearer(c, next);
    },
    async (c) => {
        try {
            const releases = await getReleases(true);
            const releaseCount = Object.keys(releases).length;

            return c.json({
                'result': `Releases cache updated successfully with ${releaseCount} releases.`,
                'error_code': 0,
                'message': null
            });
        } catch (error) {
            return c.json({
                'result': null,
                'error_code': 500,
                'message': 'Failed to update releases cache: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
);

versionsV1.get('/build_changelog/:current', cache({cacheName: 'versions-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    const current = c.req.param('current');
    const releases = await getReleases();

    if (!semverValid(current)) {
        c.status(400);
        return c.json({
            'result': null,
            'error_code': 400,
            'message': `'${current}' is not a valid semantic version.`
        });
    }

    const sortedReleaseKeys = Object.keys(releases).sort((a, b) => semverCompare(b, a));
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

    const assembledChangelog = completedChangelog.join('\n');

    return c.json({
        'result': assembledChangelog,
        'error_code': 0,
        'message': null
    });
});

versionsV1.get('/:version', cache({cacheName: 'versions-api-v1', cacheControl: 'max-age: 86400'}), etag(), prettyJSON(), async (c) => {
    const version = c.req.param('version');
    const releases = await getReleases();

    if (Object.keys(releases).length === 0) {
        c.status(500);
        return c.json({
            'result': null,
            'error_code': 500,
            'message': 'Could not retrieve release information.'
        });
    }

    if (version === 'latest') {
        const sortedKeys = Object.keys(releases).sort(semverCompare);
        const lastKey = sortedKeys.at(-1);
        
        return c.json({
            'result': lastKey ? releases[lastKey] : null,
            'error_code': 0,
            'message': null
        });
    } else if (version in releases) {
        return c.json({
            'result': releases[version],
            'error_code': 0,
            'message': null
        });
    } else {
        c.status(404);
        return c.json({
            'result': null,
            'error_code': 404,
            'message': `FOSSBilling version ${version} does not appear to exist.`
        });
    }
});

export default versionsV1;

async function getReleases(updateCache: boolean = false): Promise<Releases> {
    const c = getContext<{ Bindings: CloudflareBindings }>();
    const cachedReleases = await c.env.CACHE_KV.get('gh-fossbilling-releases');
    const cacheTTL = 86400;

    if (cachedReleases && !updateCache) {
        try {
            return JSON.parse(cachedReleases);
        } catch (error) {
            console.error("Failed to parse cached releases data:", error);
        }
    }

    try {
        const result = await ghRequest('GET /repos/{owner}/{repo}/releases', {
            owner: 'FOSSBilling',
            repo: 'FOSSBilling',
            headers: {
                'Authorization': `Bearer ${c.env.GITHUB_TOKEN}`,
            },
            per_page: 100
        });

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
            const sortedReleases = Object.fromEntries(releaseEntries.sort((a, b) => semverCompare(a[0], b[0])));
            releases = sortedReleases;
        }

        if (Object.keys(releases).length > 0) {
            await c.env.CACHE_KV.put('gh-fossbilling-releases', JSON.stringify(releases), { expirationTtl: cacheTTL });
        }
        
        return releases;
    } catch (error) {
        console.error("Failed to fetch releases from GitHub:", error);
        
        if (cachedReleases) {
            console.log("Using cached releases as fallback after API error");
            try {
                return JSON.parse(cachedReleases);
            } catch {
                return {};
            }
        }
        
        return {};
    }
}

export async function getReleaseMinPhpVersion(version: string): Promise<string> {
    const c = getContext<{ Bindings: CloudflareBindings }>();
    const composerPath = semverGte(version, '0.5.0') ? 'composer.json' : 'src/composer.json';

    try {
        const result = await ghRequest('GET /repos/{owner}/{repo}/contents/{path}{?ref}', {
            owner: 'FOSSBilling',
            repo: 'FOSSBilling',
            path: composerPath,
            ref: version,
            headers: {
                'Authorization': `Bearer ${c.env.GITHUB_TOKEN}`,
            }
        });

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