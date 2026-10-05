#!/usr/bin/env node
// Usage: npm run bump -- <patch|minor|major|x.y.z>
// Updates package.json, app.json (version and Android versionCode). Commit, tag and release by hand
// (see "Releasing" in README.md) so the changelog can be written first.
import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run bump -- <patch|minor|major|x.y.z>');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const app = JSON.parse(readFileSync('app.json', 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);

let next;
if (arg === 'patch') next = [maj, min, pat + 1];
else if (arg === 'minor') next = [maj, min + 1, 0];
else if (arg === 'major') next = [maj + 1, 0, 0];
else if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg.split('.').map(Number);
else {
  console.error(`Not a version: ${arg}`);
  process.exit(1);
}

const version = next.join('.');
pkg.version = version;
app.expo.version = version;
app.expo.android = { ...app.expo.android, versionCode: next[0] * 10000 + next[1] * 100 + next[2] };

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
console.log(`Version ${version} (build ${app.expo.android.versionCode})`);
console.log('Next: edit CHANGELOG.md, then  git commit -am "Release v' + version + '" && git tag -a v' + version + ' -m "v' + version + '"');
