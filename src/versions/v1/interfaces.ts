export type ReleaseDetails = {
    version: string; // e.g., '1.0.0'.
    released_on: string; // ISO 8601 format, e.g., '2023-10-01T12:00:00Z'.
    minimum_php_version: string; // e.g., '8.2'.
    download_url: string;
    size_bytes: number;
    is_prerelease: boolean;
    github_release_id: number;
    changelog: string; // Release notes or changelog in markdown format.
}

export type Releases = {
    [version: string]: ReleaseDetails;
}