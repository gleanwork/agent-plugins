import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// Each spec runs the real hook against a stub `claude`. The stub is a Node script that
// PATH finds by its shebang, so the suite is POSIX-only. CI runs ubuntu.
const WINDOWS = process.platform === "win32";

const here = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(here, "../../../../overrides/claude/glean/hooks/check-setup.mjs");

const PLUGIN_ID = "glean@glean-plugins";
const SAVED_URL = "https://acme-be.glean.example/mcp/gateway/proxy";
const OTHER_URL = "https://other.glean.example/mcp/default";
const MIGRATED = "server-url-migrated";
const VERSION_OK = "claude-code-version-ok";

// A stand-in for the `claude` commands the hook runs. It keeps the option's value in
// state.json and appends each call to calls.jsonl.
const STUB = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const dir = __dirname;
const state = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8"));
const args = process.argv.slice(2);
const stdin = args.includes("--values-stdin") ? fs.readFileSync(0, "utf8") : "";
fs.appendFileSync(path.join(dir, "calls.jsonl"), JSON.stringify({ args, stdin }) + "\\n");
if (state.fail && args.join(" ").startsWith(state.fail)) process.exit(1);
if (args[0] === "--version") {
  process.stdout.write(state.version + "\\n");
} else if (args[0] === "plugin" && args[1] === "list") {
  process.stdout.write(JSON.stringify(state.plugins));
} else if (args[0] === "plugin" && args[1] === "configure" && args.includes("--values-stdin")) {
  if (!state.dropWrites) state.value = JSON.parse(stdin).server_url;
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state));
} else if (args[0] === "plugin" && args[1] === "configure") {
  process.stdout.write(JSON.stringify({
    pluginId: args[2],
    configured: state.value ? ["server_url"] : [],
    unconfigured: state.value ? [] : ["server_url"],
  }));
} else {
  process.exit(2);
}
`;

interface Options {
  /** Contents of mcp-server-url.json. Omit for a user who never ran the local server. */
  saved?: unknown;
  /** The value Claude Code already holds for the option. */
  configured?: string;
  /** Whether Claude Code passes the option to the hook, as it does when the option is set. */
  optionInEnv?: boolean;
  /** Put no `claude` on PATH. */
  noCli?: boolean;
  /** How the stub reports where the plugin is installed. */
  listAs?: "installPath" | "readFromFolder" | "absent";
  /** Make the stub fail a command that starts with this text. */
  fail?: string;
  /** Make the stub accept a write and not keep it. */
  dropWrites?: boolean;
  /** What the stub prints for --version. */
  version?: string;
  /** Files that exist in the data directory before the hook runs. */
  markers?: string[];
}

interface Run {
  /** What the user sees, or "" when the hook printed nothing. */
  message: string;
  /** What the model is told, or "". */
  context: string;
  status: number | null;
  calls: { args: string[]; stdin: string }[];
  /** Each call as one line, without the version check. */
  pluginCalls: string[];
  /** The option's value in the stub after the hook ran. */
  value: string | undefined;
  dataFiles: string[];
}

function runHook(options: Options = {}): Run {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "check-setup-")));
  const dataDir = path.join(root, "data");
  const pluginRoot = path.join(root, "plugin");
  const bin = path.join(root, "bin");
  for (const dir of [dataDir, pluginRoot, bin]) fs.mkdirSync(dir);

  if (options.saved !== undefined) {
    fs.writeFileSync(
      path.join(dataDir, "mcp-server-url.json"),
      typeof options.saved === "string" ? options.saved : JSON.stringify(options.saved),
    );
    // The hook must never read this file.
    fs.writeFileSync(path.join(dataDir, "mcp-credentials.json"), "{not json", { mode: 0o000 });
  }
  for (const marker of options.markers ?? []) fs.writeFileSync(path.join(dataDir, marker), "");

  const listAs = options.listAs ?? "installPath";
  const plugins =
    listAs === "absent"
      ? [{ id: "other@market", installPath: path.join(root, "elsewhere") }]
      : [
          { id: "other@market", installPath: path.join(root, "elsewhere") },
          { id: PLUGIN_ID, [listAs]: pluginRoot },
        ];
  fs.writeFileSync(
    path.join(bin, "state.json"),
    JSON.stringify({
      plugins,
      value: options.configured,
      fail: options.fail,
      dropWrites: options.dropWrites,
      version: options.version ?? "2.1.319 (Claude Code)",
    }),
  );
  if (!options.noCli) fs.writeFileSync(path.join(bin, "claude"), STUB, { mode: 0o755 });

  try {
    const result = spawnSync(process.execPath, [HOOK], {
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }),
      env: {
        CLAUDE_PLUGIN_DATA: dataDir,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        // The stub's shebang needs `node`, and the stub's directory comes first, so a real
        // `claude` on the machine that runs the tests cannot answer. With no stub, PATH
        // holds nothing that can.
        PATH: options.noCli ? bin : [bin, path.dirname(process.execPath)].join(path.delimiter),
        HOME: root,
        ...(options.optionInEnv
          ? { CLAUDE_PLUGIN_OPTION_SERVER_URL: options.configured ?? SAVED_URL }
          : {}),
      },
    });
    const calls = fs.existsSync(path.join(bin, "calls.jsonl"))
      ? fs
          .readFileSync(path.join(bin, "calls.jsonl"), "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
      : [];
    const output = result.stdout ? JSON.parse(result.stdout) : null;
    return {
      message: output?.systemMessage ?? "",
      context: output?.hookSpecificOutput?.additionalContext ?? "",
      status: result.status,
      calls,
      pluginCalls: calls
        .map((call) => call.args.join(" "))
        .filter((line) => line !== "--version"),
      value: JSON.parse(fs.readFileSync(path.join(bin, "state.json"), "utf8")).value,
      dataFiles: fs.readdirSync(dataDir).sort(),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe.skipIf(WINDOWS)("check-setup hook: a URL saved by plugin 3.x", () => {
  it("carries the saved URL over to the plugin option", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL } });

    expect(run.status).toBe(0);
    expect(run.value).toBe(SAVED_URL);
    expect(run.dataFiles).toContain(MIGRATED);
    expect(run.pluginCalls).toEqual([
      "plugin list --json",
      `plugin configure ${PLUGIN_ID} --json`,
      `plugin configure ${PLUGIN_ID} --values-stdin`,
      `plugin configure ${PLUGIN_ID} --json`,
    ]);
    expect(run.message).toContain(SAVED_URL);
    expect(run.message).toContain("/reload-plugins");
    expect(run.message).toContain("/mcp");
  });

  it("passes the URL on stdin and never on the command line", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL } });

    const write = run.calls.find((call) => call.args.includes("--values-stdin"));
    expect(JSON.parse(write!.stdin)).toEqual({ server_url: SAVED_URL });
    expect(run.calls.flatMap((call) => call.args).join(" ")).not.toContain("https://");
  });

  it("tells the model how the user connects Glean, without the URL", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL } });

    expect(run.context).toContain("/reload-plugins");
    expect(run.context).not.toContain("https://");
  });

  it("leaves the old files in place and reads no credentials", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL } });

    // The credentials file is unreadable and not JSON: a hook that opened it would fail.
    expect(run.status).toBe(0);
    expect(run.dataFiles).toEqual([
      VERSION_OK,
      "mcp-credentials.json",
      "mcp-server-url.json",
      MIGRATED,
    ]);
  });

  it("finds a plugin that Claude Code reads from a folder", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL }, listAs: "readFromFolder" });

    expect(run.value).toBe(SAVED_URL);
    expect(run.dataFiles).toContain(MIGRATED);
  });

  it("keeps a value the user already set", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL }, configured: OTHER_URL });

    expect(run.value).toBe(OTHER_URL);
    expect(run.pluginCalls.some((line) => line.includes("--values-stdin"))).toBe(false);
    expect(run.message).toBe("");
    expect(run.dataFiles).toContain(MIGRATED);
  });

  it("carries the URL over one time only", () => {
    // The user cleared the option after the update. The hook says so and leaves it cleared.
    const run = runHook({ saved: { serverUrl: SAVED_URL }, markers: [MIGRATED] });

    expect(run.pluginCalls).toEqual([]);
    expect(run.value).toBeUndefined();
    expect(run.message).toContain("no server URL");
    expect(run.message).toContain(SAVED_URL);
  });

  it.each<[string, Options]>([
    ["claude is not on PATH", { noCli: true }],
    ["Claude Code does not list the plugin", { listAs: "absent" }],
    ["the list command fails", { fail: "plugin list" }],
    ["the write fails", { fail: `plugin configure ${PLUGIN_ID} --values-stdin` }],
    ["the write does not stick", { dropWrites: true }],
  ])("gives the user the URL to set by hand when %s", (_name, options) => {
    const run = runHook({ saved: { serverUrl: SAVED_URL }, ...options });

    expect(run.status).toBe(0);
    expect(run.value).toBeUndefined();
    expect(run.message).toContain(SAVED_URL);
    expect(run.message).toContain("/plugin");
    expect(run.context).not.toContain("https://");
    // No marker, so the next session tries again.
    expect(run.dataFiles).not.toContain(MIGRATED);
  });

  it.each([
    ["is not JSON", "{nope"],
    ["has no serverUrl", { url: SAVED_URL }],
    ["is not a string", { serverUrl: 42 }],
    ["is not https", { serverUrl: "http://acme-be.glean.example/mcp/default" }],
    ["uses another scheme", { serverUrl: "javascript:alert(1)" }],
    ["is not a URL", { serverUrl: "acme-be.glean.example/mcp/default" }],
    ["holds a line break", { serverUrl: `${SAVED_URL}\nhttps://evil.example` }],
  ])("does not use a saved file that %s", (_name, saved) => {
    const run = runHook({ saved });

    expect(run.status).toBe(0);
    expect(run.pluginCalls).toEqual([]);
    expect(run.value).toBeUndefined();
    // The user is told to set a URL, and the file's contents are not repeated.
    expect(run.message).toContain("no server URL");
    expect(run.message).not.toMatch(/glean\.example|evil|alert/);
    expect(run.dataFiles).not.toContain(MIGRATED);
  });
});

describe.skipIf(WINDOWS)("check-setup hook: no URL to carry over", () => {
  it("tells a new user to set the server URL", () => {
    const run = runHook();

    expect(run.status).toBe(0);
    expect(run.pluginCalls).toEqual([]);
    expect(run.message).toContain("no server URL");
    expect(run.message).toContain("/plugin");
    expect(run.message).toContain("/mcp");
    expect(run.context).toContain("server URL option is not set");
  });

  it("says nothing once the option is set", () => {
    const run = runHook({ configured: OTHER_URL, optionInEnv: true });

    expect(run.message).toBe("");
    expect(run.pluginCalls).toEqual([]);
    expect(run.value).toBe(OTHER_URL);
  });

  it("starts no process once the option is set and the version is known", () => {
    const run = runHook({
      saved: { serverUrl: SAVED_URL },
      configured: OTHER_URL,
      optionInEnv: true,
      markers: [MIGRATED, VERSION_OK],
    });

    expect(run.message).toBe("");
    expect(run.calls).toEqual([]);
  });

  it("does not carry a saved URL over a value the user set first", () => {
    // The option is set, so the saved URL is retired without a process.
    const first = runHook({
      saved: { serverUrl: SAVED_URL },
      configured: OTHER_URL,
      optionInEnv: true,
    });

    expect(first.pluginCalls).toEqual([]);
    expect(first.value).toBe(OTHER_URL);
    expect(first.dataFiles).toContain(MIGRATED);
  });
});

describe.skipIf(WINDOWS)("check-setup hook: the Claude Code version", () => {
  it.each(["2.1.273 (Claude Code)", "2.0.999 (Claude Code)", "1.9.999"])(
    "tells the user to update from %s",
    (version) => {
      const run = runHook({ configured: OTHER_URL, optionInEnv: true, version });

      expect(run.status).toBe(0);
      expect(run.message).toContain("2.1.274");
      expect(run.message).toContain(version.split(" ")[0]);
      expect(run.message).toContain("claude update");
      expect(run.context).toContain("claude update");
      // No marker, so the next session checks again.
      expect(run.dataFiles).not.toContain(VERSION_OK);
    },
  );

  it.each(["2.1.274 (Claude Code)", "2.1.319 (Claude Code)", "2.2.0", "3.0.0 (Claude Code)"])(
    "says nothing about %s and does not ask again",
    (version) => {
      const run = runHook({ configured: OTHER_URL, optionInEnv: true, version });

      expect(run.message).toBe("");
      expect(run.dataFiles).toContain(VERSION_OK);
    },
  );

  it("does not ask for the version once it was new enough", () => {
    const run = runHook({
      configured: OTHER_URL,
      optionInEnv: true,
      version: "2.1.100 (Claude Code)",
      markers: [VERSION_OK],
    });

    expect(run.calls).toEqual([]);
    expect(run.message).toBe("");
  });

  it.each<[string, Options]>([
    ["claude prints no version", { version: "Claude Code" }],
    ["the version command fails", { fail: "--version" }],
    ["claude is not on PATH", { noCli: true }],
  ])("says nothing when %s", (_name, options) => {
    const run = runHook({ configured: OTHER_URL, optionInEnv: true, ...options });

    expect(run.status).toBe(0);
    expect(run.message).toBe("");
    expect(run.dataFiles).not.toContain(VERSION_OK);
  });

  it("gives both messages to a 3.x user on an old Claude Code", () => {
    const run = runHook({ saved: { serverUrl: SAVED_URL }, version: "2.1.200 (Claude Code)" });

    expect(run.value).toBe(SAVED_URL);
    expect(run.message).toContain("carried over");
    expect(run.message).toContain("claude update");
    expect(run.context).toContain("/reload-plugins");
    expect(run.context).toContain("claude update");
  });
});
