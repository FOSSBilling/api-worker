export type ReleaseDetails = {
  version: string;
  released_on: string;
  minimum_php_version: string;
  download_url: string;
  size_bytes: number;
  is_prerelease: boolean;
  github_release_id: number;
  changelog: string;
};

export type Releases = {
  [version: string]: ReleaseDetails;
};
