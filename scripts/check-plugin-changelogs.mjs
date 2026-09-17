#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = join(root, "CHANGELOG.md");
const canonical = readFileSync(canonicalPath, "utf8");

const paths = [
  "shared/glean/CHANGELOG.md",
  "shared/glean-dev-docs/CHANGELOG.md",
  "dist/claude/plugins/glean/CHANGELOG.md",
  "dist/claude/plugins/glean-dev-docs/CHANGELOG.md",
  "dist/cursor/glean/CHANGELOG.md",
  "dist/cursor/glean-dev-docs/CHANGELOG.md",
  "dist/codex/plugins/glean/CHANGELOG.md",
  "dist/codex/plugins/glean-dev-docs/CHANGELOG.md",
];

const mismatches = paths.filter((relativePath) => {
  const actual = readFileSync(join(root, relativePath), "utf8");
  return actual !== canonical;
});

if (mismatches.length > 0) {
  throw new Error(
    `Plugin changelogs differ from CHANGELOG.md:\n${mismatches
      .map((relativePath) => `- ${relativePath}`)
      .join("\n")}`,
  );
}

console.log(`All ${paths.length} plugin changelogs match CHANGELOG.md.`);
