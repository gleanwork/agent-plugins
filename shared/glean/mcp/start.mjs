#!/usr/bin/env node
// @ts-check
// Invoked by the plugin host (Claude Code, Codex, or Cursor) to launch the Glean
// MCP server. The plugin ships a single-file esbuild output at dist/index.js with
// every non-builtin inlined — no node_modules next to it. This script handles
// env sanitation before launching the plugin proper.
import os from "node:os";
import path from "node:path";

// Treat empty strings and un-interpolated "${VAR}" placeholders (which a host
// may pass through verbatim when a variable is unset) as "not set" — matching
// the bundle's own readEnv / resolveSessionId guards.
/** @param {string | undefined} v @returns {string | undefined} */
function val(v) {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (t === "" || t.startsWith("${")) return undefined;
  return t;
}

// Resolve where credentials, caches, and config are stored.
// CLAUDE_PLUGIN_DATA is the managed lifecycle dir provided by the plugin host.
const pluginDataDir =
  val(process.env.CLAUDE_PLUGIN_DATA) ??
  path.join(os.homedir() || os.tmpdir(), ".glean");
process.env.PLUGIN_DATA_DIR = pluginDataDir;

// Resolve the chat session id host-side. Host-awareness lives here, not in the
// plugin: the launcher reads whatever variable this host exposes and exports the
// normalized GLEAN_SESSION_ID that the Node bundle reads. Claude Code exposes
// CLAUDE_CODE_SESSION_ID; Codex exposes the conversation id as CODEX_THREAD_ID.
// Hosts that expose no session id (Cursor) leave it unset, and the plugin falls
// back to a generated per-process id.
const sessionId =
  val(process.env.CLAUDE_CODE_SESSION_ID) ?? val(process.env.CODEX_THREAD_ID);
if (sessionId !== undefined) {
  process.env.GLEAN_SESSION_ID = sessionId;
}

// Boot the server in-process. Import via a file URL resolved against this
// module so the dynamic specifier works regardless of cwd and on Windows paths.
await import(new URL("./dist/index.js", import.meta.url).href);
