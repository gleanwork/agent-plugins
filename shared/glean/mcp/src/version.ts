// Read at runtime rather than injected at build time: `../package.json` hits the
// shipped manifest from both src/ and dist/, and that file has to exist anyway
// for Node to load the bundle as ESM. Kept in step with the root manifest by
// scripts/sync-release-metadata.mjs.
import { readFileSync } from "node:fs";

export const PLUGIN_VERSION: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
