import { compareVersions, parseVersion } from './semver';

export const UPDATE_REPO = 'jaba0x/JeepMonitor';

export interface UpdateInfo {
  version: string;
  notes: string;
  apkUrl: string;
  apkName: string;
  sizeBytes: number;
  pageUrl: string;
}

interface GithubRelease {
  tag_name?: string;
  body?: string | null;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name: string; browser_download_url: string; size: number }[];
}

/** Turns a GitHub "latest release" payload into an update, or null when it is not newer than `current`. */
export function pickUpdate(release: GithubRelease, current: string): UpdateInfo | null {
  if (!release.tag_name || release.draft || release.prerelease) return null;
  const version = release.tag_name.replace(/^v/, '');
  if (!parseVersion(version) || compareVersions(version, current) <= 0) return null;
  const apk = release.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));
  if (!apk) return null;
  return {
    version,
    notes: (release.body ?? '').trim(),
    apkUrl: apk.browser_download_url,
    apkName: apk.name,
    sizeBytes: apk.size,
    pageUrl: release.html_url ?? `https://github.com/${UPDATE_REPO}/releases`,
  };
}

/** Asks GitHub for the latest published release. Throws on network or API errors. */
export async function fetchLatestUpdate(current: string): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null; // no release yet
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return pickUpdate((await res.json()) as GithubRelease, current);
}
