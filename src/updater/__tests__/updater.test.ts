import { describe, expect, it } from 'vitest';
import { pickUpdate } from '../github';
import { compareVersions, parseVersion } from '../semver';

describe('semver', () => {
  it('parses tags', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('0.10.0-beta')).toEqual([0, 10, 0]);
    expect(parseVersion('nightly')).toBeNull();
  });
  it('compares numerically, not as text', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.4.0', '0.4.1')).toBeLessThan(0);
  });
});

describe('pickUpdate', () => {
  const asset = { name: 'JeepMonitor-0.5.0.apk', browser_download_url: 'https://example/x.apk', size: 10 };
  it('returns a newer release with an apk', () => {
    const u = pickUpdate({ tag_name: 'v0.5.0', body: ' notes ', assets: [asset] }, '0.4.0');
    expect(u?.version).toBe('0.5.0');
    expect(u?.notes).toBe('notes');
  });
  it('ignores the same version, drafts, prereleases and releases without an apk', () => {
    expect(pickUpdate({ tag_name: 'v0.4.0', assets: [asset] }, '0.4.0')).toBeNull();
    expect(pickUpdate({ tag_name: 'v0.5.0', draft: true, assets: [asset] }, '0.4.0')).toBeNull();
    expect(pickUpdate({ tag_name: 'v0.5.0', prerelease: true, assets: [asset] }, '0.4.0')).toBeNull();
    expect(pickUpdate({ tag_name: 'v0.5.0', assets: [] }, '0.4.0')).toBeNull();
  });
});
