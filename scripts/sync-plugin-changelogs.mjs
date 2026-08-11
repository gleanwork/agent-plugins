#!/usr/bin/env node
// Propagate the canonical root changelog into each shared plugin. Runs
// automatically via the `prebuild` npm script. Version files are owned by
// release-it and @release-it/bumper instead of being rewritten during builds.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const changelog = join(root, "CHANGELOG.md");
const buckets = ["shared/glean", "shared/glean-dev-docs"];

for (const bucket of buckets) {
  copyFileSync(changelog, join(root, bucket, "CHANGELOG.md"));
  console.log(`synced CHANGELOG.md -> ${bucket}`);
}
