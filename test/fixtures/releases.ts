/**
 * Processed Releases Mock Data
 *
 * Fixtures for testing releases processing and API responses
 *
 * @license AGPL-3.0
 */

import { Releases } from "../../src/versions/v1/interfaces";

export const mockReleases: Releases = {
  "0.5.0": {
    version: "0.5.0",
    released_on: "2023-01-01T00:00:00Z",
    minimum_php_version: "8.1",
    download_url:
      "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.5.0/FOSSBilling.zip",
    size_bytes: 1024000,
    is_prerelease: false,
    github_release_id: 1001,
    changelog: "## 0.5.0\n- Initial release"
  },
  "0.5.1": {
    version: "0.5.1",
    released_on: "2023-02-01T00:00:00Z",
    minimum_php_version: "8.1",
    download_url:
      "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.5.1/FOSSBilling.zip",
    size_bytes: 1025000,
    is_prerelease: false,
    github_release_id: 1002,
    changelog: "## 0.5.1\n- Bug fixes"
  },
  "0.5.2": {
    version: "0.5.2",
    released_on: "2023-03-01T00:00:00Z",
    minimum_php_version: "8.1",
    download_url:
      "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.5.2/FOSSBilling.zip",
    size_bytes: 1026000,
    is_prerelease: false,
    github_release_id: 1003,
    changelog: "## 0.5.2\n- More fixes"
  },
  "0.6.0": {
    version: "0.6.0",
    released_on: "2023-04-01T00:00:00Z",
    minimum_php_version: "8.2",
    download_url:
      "https://github.com/FOSSBilling/FOSSBilling/releases/download/0.6.0/FOSSBilling.zip",
    size_bytes: 1030000,
    is_prerelease: false,
    github_release_id: 1004,
    changelog: "## 0.6.0\n- New features"
  }
};

export const mockVersionsApiResponse = {
  result: {
    "0.5.0": { version: "0.5.0" },
    "0.5.1": { version: "0.5.1" },
    "0.5.2": { version: "0.5.2" },
    "0.6.0": { version: "0.6.0" }
  }
};
