export interface StatsData {
  releaseSizes: ReleaseSizeData[];
  phpVersions: PhpVersionData[];
  patchesPerRelease: PatchesPerReleaseData[];
  releasesPerYear: ReleasesPerYearData[];
}

export interface ReleaseSizeData {
  version: string;
  size_mb: number;
  released_on: string;
}

export interface PhpVersionData {
  version: string;
  php_version: string;
  released_on: string;
}

export interface PatchesPerReleaseData {
  version_line: string;
  patch_count: number;
}

export interface ReleasesPerYearData {
  year: string;
  release_count: number;
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}
