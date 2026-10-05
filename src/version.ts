const app = require('../app.json').expo as { version: string; android?: { versionCode?: number } };

/** Semantic version, kept in step with package.json by `npm run bump`. */
export const VERSION: string = app.version;
/** Android versionCode: major * 10000 + minor * 100 + patch. */
export const BUILD: number = app.android?.versionCode ?? 0;
