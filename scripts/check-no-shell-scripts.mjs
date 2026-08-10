#!/usr/bin/env node
// CI guard: fail if any shell/bash script is added under the shared MCP tree.
//
// Why: the local-mcp plugin ships and runs on end-user machines, including
// Windows, where POSIX shell (.sh / bash) is not available. We already
// migrated the launcher from start.sh to start.mjs for exactly this reason.
// Every executable helper the plugin relies on must be cross-platform, so the
// rule is: no shell scripts in the plugin source — use a Node.js (.mjs) script
// instead and invoke it with `node <script>.mjs`.
//
// This guard is itself written in Node (not bash) so it runs identically on
// Windows, macOS, and Linux, both in CI and locally (`npm run check:no-shell`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Scope: the local MCP source. Broaden this list if the rule should
// cover other source trees too.
const SCAN_ROOTS = ["shared/glean/mcp"];
// Never descend into generated/vendored trees.
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");

// A shell script is anything with a shell extension, or any file whose
// shebang invokes bash/sh. A `#!/usr/bin/env node` shebang is fine.
const SHELL_EXT = /\.(sh|bash|zsh|ksh)$/i;
const SHELL_SHEBANG = /^#!\s*(\S*\/)?(env\s+)?(bash|sh|zsh|ksh)\b/;

function hasShellShebang(absPath) {
  let fd;
  try {
    fd = fs.openSync(absPath, "r");
    const buf = Buffer.alloc(256);
    const bytes = fs.readSync(fd, buf, 0, 256, 0);
    const firstLine = buf.subarray(0, bytes).toString("utf8").split(/\r?\n/, 1)[0];
    return SHELL_SHEBANG.test(firstLine);
  } catch {
    return false; // unreadable/binary — not our concern
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // missing dir — nothing to scan
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out);
    } else if (entry.isFile()) {
      if (SHELL_EXT.test(entry.name) || hasShellShebang(abs)) out.push(abs);
    }
  }
}

const offenders = [];
for (const root of SCAN_ROOTS) walk(path.join(repoRoot, root), offenders);

if (offenders.length > 0) {
  const rel = offenders
    .map((p) => "  - " + path.relative(repoRoot, p))
    .sort()
    .join("\n");
  console.error(
    `\n\u274c Shell/bash scripts are not allowed in the local-mcp plugin source.\n\n` +
      `Found ${offenders.length} shell script(s):\n${rel}\n\n` +
      `The plugin runs on end-user machines including Windows, where POSIX shell\n` +
      `is unavailable. Use a cross-platform Node.js script instead:\n\n` +
      `  - Write it as a .mjs file (see shared/glean/mcp/start.mjs).\n` +
      `  - Use Node built-ins (node:fs, node:path, node:child_process) instead of\n` +
      `    shell utilities, and avoid shell-only syntax.\n` +
      `  - Invoke it with "node <script>.mjs" so it works on Windows/macOS/Linux.\n`,
  );
  process.exit(1);
}

console.log(
  `\u2705 No shell scripts under ${SCAN_ROOTS.join(", ")} (cross-platform / Windows-safe).`,
);
