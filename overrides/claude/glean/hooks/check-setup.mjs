#!/usr/bin/env node
// SessionStart hook for Claude Code.
//
// This plugin connects Claude Code to the user's Glean MCP server directly. The
// URL comes from the plugin's `server_url` option, and Claude Code loads no
// Glean server until that option has a value. The hook tells the user what is
// left to do, and stays silent when nothing is.
//
// 1. Carry the URL over from plugin 3.x. Earlier versions ran a local MCP
//    server, which saved the URL in mcp-server-url.json in the plugin's data
//    directory. An update keeps that directory and leaves the new option empty.
//    The hook saves the old URL to the option, once, with `claude plugin
//    configure`, which is the same path the /plugin screen uses. It does not
//    edit settings files.
// 2. Say so when the option is not set and there is nothing to carry over.
// 3. Say so when Claude Code is older than the first version that can show
//    Glean's approval prompt.
//
// It reads only the saved URL. It never reads the saved credentials, and it
// leaves both old files in place. The user signs in again under /mcp, because
// Claude Code holds its own token for a server it connects to.
//
// It never blocks the session: every path exits 0.
//
// Remove step 1 when users of the local server have had time to update.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OPTION = "server_url";
const SAVED_URL_FILE = "mcp-server-url.json";
// Written once the saved URL needs no more handling, so that it is carried over
// one time only. A user who clears the option later keeps it cleared.
const MIGRATED_FILE = "server-url-migrated";
// Written once Claude Code is new enough, so that later sessions do not start a
// process to ask again. Versions only go up.
const VERSION_OK_FILE = "claude-code-version-ok";
// The first Claude Code that speaks MCP 2026-07-28, which Glean needs to send
// its approval prompt.
const MIN_VERSION = [2, 1, 274];
const CLI_TIMEOUT_MS = 10_000;

const dataDir = process.env.CLAUDE_PLUGIN_DATA;
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!dataDir || !pluginRoot) process.exit(0);

const exists = (name) => fs.existsSync(path.join(dataDir, name));

function mark(name, text = new Date().toISOString()) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, name), `${text}\n`, { mode: 0o600 });
  } catch {
    // The hook does the same work again next session.
  }
}

// CLAUDE_CODE_EXECPATH is the running Claude Code, when the host sets it.
// Otherwise look `claude` up on PATH. On Windows an npm install provides
// claude.cmd, which Node runs only through a shell.
function claudeCandidates() {
  const candidates = [];
  if (process.env.CLAUDE_CODE_EXECPATH) {
    candidates.push({ file: process.env.CLAUDE_CODE_EXECPATH, shell: false });
  }
  candidates.push({ file: "claude", shell: process.platform === "win32" });
  return candidates;
}

function claude(args, input) {
  for (const { file, shell } of claudeCandidates()) {
    const result = spawnSync(file, args, {
      input,
      encoding: "utf8",
      timeout: CLI_TIMEOUT_MS,
      shell,
      env: { ...process.env, NO_COLOR: "1" },
    });
    if (!result.error && result.status === 0) return result.stdout;
  }
  throw new Error(`claude ${args.join(" ")} failed`);
}

/** The URL the local server saved, or undefined when there is no usable one. */
function savedUrl() {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(path.join(dataDir, SAVED_URL_FILE), "utf8")).serverUrl;
  } catch {
    return undefined;
  }
  if (typeof value !== "string" || value.length > 2048 || /\s/.test(value)) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return undefined;
  }
}

/** The id Claude Code installed this plugin under, such as glean@glean-plugins. */
function pluginId() {
  const here = realPath(pluginRoot);
  const plugins = JSON.parse(claude(["plugin", "list", "--json"]));
  const plugin = plugins.find(
    (entry) => here && (realPath(entry.installPath) === here || realPath(entry.readFromFolder) === here),
  );
  // The id goes on a command line, which a shell reads on Windows.
  if (!plugin || !/^[\w.-]+@[\w.-]+$/.test(plugin.id)) throw new Error("plugin id not found");
  return plugin.id;
}

function isConfigured(id) {
  const state = JSON.parse(claude(["plugin", "configure", id, "--json"]));
  return Array.isArray(state.configured) && state.configured.includes(OPTION);
}

/**
 * What to say about the server URL: undefined when it is set, otherwise a
 * message for the user and a note for the model.
 */
function serverUrlNotice() {
  // Claude Code gives a hook each option that has a value.
  if (process.env[`CLAUDE_PLUGIN_OPTION_${OPTION.toUpperCase()}`]) {
    if (!exists(MIGRATED_FILE)) mark(MIGRATED_FILE);
    return undefined;
  }

  const url = savedUrl();
  const byHand = {
    user:
      "Glean is not connected, because the Glean plugin has no server URL. " +
      `Open /plugin, choose Glean, and set the server URL${url ? ` to ${url}` : ""}. ` +
      "Then run /reload-plugins and sign in to Glean under /mcp.",
    model:
      "The Glean plugin's server is not connected, because its server URL option is not set. " +
      "If the user asks for Glean, tell them to set the server URL in the Glean plugin's options under /plugin, " +
      "then run /reload-plugins and sign in to Glean under /mcp.",
  };
  // Nothing to carry over: a new user, or a URL that was carried over before.
  if (!url || exists(MIGRATED_FILE)) return byHand;

  try {
    const id = pluginId();
    if (isConfigured(id)) {
      mark(MIGRATED_FILE);
      return undefined;
    }
    // The URL goes in on stdin, never on the command line.
    claude(["plugin", "configure", id, "--values-stdin"], JSON.stringify({ [OPTION]: url }));
    if (!isConfigured(id)) throw new Error("the option was not saved");
    mark(MIGRATED_FILE);
    return {
      user:
        `Glean now connects to your Glean server directly, and your server URL (${url}) is carried over. ` +
        "To finish, run /reload-plugins, then sign in to Glean under /mcp.",
      model:
        "The Glean plugin was updated and its server is not connected in this session yet. " +
        "If the user asks for Glean, tell them to run /reload-plugins and then sign in to Glean under /mcp.",
    };
  } catch {
    // No marker: the next session tries again, or finds that the user set the URL.
    return byHand;
  }
}

/** What to say about the Claude Code version: undefined when it is new enough or unknown. */
function versionNotice() {
  if (exists(VERSION_OK_FILE)) return undefined;
  let version;
  try {
    version = /(\d+)\.(\d+)\.(\d+)/.exec(claude(["--version"]))?.slice(1).map(Number);
  } catch {
    return undefined;
  }
  if (!version) return undefined;
  const behind = MIN_VERSION.findIndex((part, index) => version[index] !== part);
  if (behind === -1 || version[behind] > MIN_VERSION[behind]) {
    mark(VERSION_OK_FILE, version.join("."));
    return undefined;
  }
  const floor = MIN_VERSION.join(".");
  return {
    user:
      `Glean needs Claude Code ${floor} or later to ask you before it changes anything in your apps. ` +
      `This is Claude Code ${version.join(".")}. Run \`claude update\`.`,
    model:
      `This Claude Code is older than ${floor}, so Glean cannot show its approval prompt and may refuse actions that change data. ` +
      "If a Glean action is refused for that reason, tell the user to run `claude update`.",
  };
}

const notices = [serverUrlNotice(), versionNotice()].filter(Boolean);
if (notices.length > 0) {
  process.stdout.write(
    JSON.stringify({
      systemMessage: notices.map((notice) => notice.user).join("\n\n"),
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: notices.map((notice) => notice.model).join("\n\n"),
      },
    }),
  );
}
