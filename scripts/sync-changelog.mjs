#!/usr/bin/env node
// Propagate the canonical root CHANGELOG.md into each source bucket so every
// built plugin ships the same changelog. Runs automatically via the `prebuild`
// npm script. The root CHANGELOG.md is the single source of truth (managed by
// release-it); the per-bucket copies are derived and should not be hand-edited.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "CHANGELOG.md");
const buckets = [
  "sources/claude",
  "sources/codex",
  "sources/cursor",
  "sources/dev-docs",
];

for (const bucket of buckets) {
  copyFileSync(source, join(root, bucket, "CHANGELOG.md"));
  console.log(`synced CHANGELOG.md -> ${bucket}`);
}
