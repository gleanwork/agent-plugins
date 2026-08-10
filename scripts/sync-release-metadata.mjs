#!/usr/bin/env node
// Propagate canonical root release metadata into each source bucket so every
// built plugin ships the same values. Runs automatically via the `prebuild`
// npm script. The root CHANGELOG.md and package.json are the single sources of
// truth (managed by release-it); the copies below are derived and should not be
// hand-edited.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);

const changelog = join(root, "CHANGELOG.md");
const buckets = [
  "sources/claude",
  "sources/codex",
  "sources/cursor",
  "sources/dev-docs",
];

for (const bucket of buckets) {
  copyFileSync(changelog, join(root, bucket, "CHANGELOG.md"));
  console.log(`synced CHANGELOG.md -> ${bucket}`);
}

// Textual replace, not a JSON round-trip, to keep the release diff to one line.
const manifestPath = join(root, "sources/local-mcp/package.json");
const before = readFileSync(manifestPath, "utf8");
if (!/"version":\s*"[^"]*"/.test(before)) {
  throw new Error(
    `No "version" field in ${manifestPath} to sync. Add one — the local MCP ` +
      `server reads it at runtime to report its own version.`,
  );
}
writeFileSync(
  manifestPath,
  before.replace(/("version":\s*")[^"]*"/, `$1${version}"`),
);
console.log(`synced version ${version} -> sources/local-mcp`);
