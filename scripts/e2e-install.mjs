#!/usr/bin/env node
// @ts-check
// Install the Agent Plugins output in real clients and check what each one
// registered. Every client runs with its own throwaway home, so your own
// client config and Glean credentials are never read or changed.
//
//   node scripts/e2e-install.mjs --source dist/agent-plugins
//   node scripts/e2e-install.mjs --source gleanwork/glean-plugins --ref pluginpack/sync-agent-plugins
//
// Options:
//   --source <path|owner/repo>  Marketplace source. Default: dist/agent-plugins
//   --ref <ref>                 Git ref for a GitHub source
//   --clients <list>            Comma-separated. Default: codex,copilot
//   --keep                      Keep the temporary homes for inspection
//
// Checks, per client: the marketplace adds, both plugins install, the glean
// plugin has its skills (and, in Copilot, its agents), and the Glean MCP server
// starts from the client's resolved config and answers initialize + tools/list.
// It does not sign in to Glean or call a tool; do that in a real session.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MARKETPLACE = "glean-plugins";
const PLUGINS = ["glean", "glean-dev-docs"];
const MCP_SERVER = "glean_plugin";
const MCP_TIMEOUT_MS = 30_000;

const args = parseArgs(process.argv.slice(2));
const source = looksLocal(args.source)
  ? path.resolve(args.source)
  : args.source;
const clients = args.clients.split(",").map((c) => c.trim());

/** @type {{ client: string, check: string, ok: boolean, detail: string }[]} */
const results = [];
const homes = [];

for (const client of clients) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `e2e-${client}-`));
  homes.push(home);
  if (client === "codex") await runCodex(home);
  else if (client === "copilot") await runCopilot(home);
  else record(client, "known client", false, `unknown client "${client}"`);
}

report();
if (!args.keep)
  for (const home of homes) fs.rmSync(home, { recursive: true, force: true });
else console.log(`\nKept: ${homes.join(" ")}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);

// --- clients ---------------------------------------------------------------

/** @param {string} home */
async function runCodex(home) {
  const env = { ...process.env, CODEX_HOME: home };
  const add = ["plugin", "marketplace", "add", source];
  if (args.ref) add.push("--ref", args.ref);
  if (!step("codex", "marketplace add", "codex", add, env)) return;
  for (const plugin of PLUGINS) {
    step(
      "codex",
      `install ${plugin}`,
      "codex",
      ["plugin", "add", `${plugin}@${MARKETPLACE}`],
      env,
    );
  }

  const root = newestDir(
    path.join(home, "plugins", "cache", MARKETPLACE, "glean"),
  );
  checkPackage("codex", root, { agents: false });

  const list = run("codex", ["mcp", "list", "--json"], env);
  const server = list.ok
    ? JSON.parse(list.stdout).find((s) => s.name === MCP_SERVER)
    : undefined;
  if (!server)
    return record(
      "codex",
      "MCP server registered",
      false,
      list.stderr || "not listed",
    );
  record(
    "codex",
    "MCP server registered",
    true,
    `${server.transport.command} ${server.transport.args.join(" ")}`,
  );
  await checkMcp("codex", server.transport, server.transport.cwd, home);
}

/** @param {string} home */
async function runCopilot(home) {
  const env = { ...process.env, COPILOT_HOME: home };
  const [bin, ...pre] = copilotCommand();
  const src =
    args.ref && !looksLocal(args.source) ? `${source}#${args.ref}` : source;
  if (
    !step(
      "copilot",
      "marketplace add",
      bin,
      [...pre, "plugin", "marketplace", "add", src],
      env,
    )
  )
    return;
  for (const plugin of PLUGINS) {
    step(
      "copilot",
      `install ${plugin}`,
      bin,
      [...pre, "plugin", "install", `${plugin}@${MARKETPLACE}`],
      env,
    );
  }

  // A local marketplace is loaded in place; a GitHub one is copied.
  const installed = path.join(home, "installed-plugins", MARKETPLACE, "glean");
  const root = fs.existsSync(installed)
    ? installed
    : looksLocal(args.source)
      ? path.join(source, "plugins", "glean")
      : undefined;
  checkPackage("copilot", root, { agents: true });

  const list = run(bin, [...pre, "mcp", "list", "--json"], env);
  const server = list.ok
    ? JSON.parse(list.stdout).mcpServers?.[MCP_SERVER]
    : undefined;
  if (!server)
    return record(
      "copilot",
      "MCP server registered",
      false,
      list.stderr || "not listed",
    );
  record(
    "copilot",
    "MCP server registered",
    true,
    `${server.command} ${server.args.join(" ")}`,
  );
  await checkMcp("copilot", server, server.env?.PLUGIN_ROOT ?? root, home);
}

function copilotCommand() {
  const onPath =
    spawnSync("copilot", ["--version"], { stdio: "ignore" }).status === 0;
  return onPath ? ["copilot"] : ["npx", "-y", "@github/copilot"];
}

// --- checks ----------------------------------------------------------------

/**
 * @param {string} client
 * @param {string | undefined} root
 * @param {{ agents: boolean }} opts
 */
function checkPackage(client, root, opts) {
  if (!root || !fs.existsSync(path.join(root, "plugin.json"))) {
    return record(
      client,
      "glean package installed",
      false,
      `no plugin.json under ${root}`,
    );
  }
  record(client, "glean package installed", true, root);
  const skills = countFiles(path.join(root, "skills"), (f) => f === "SKILL.md");
  record(client, "glean skills present", skills > 0, `${skills} skills`);
  if (opts.agents) {
    const dir = path.join(root, "com.github.copilot", "agents");
    const agents = countFiles(dir, (f) => f.endsWith(".agent.md"));
    record(client, "Copilot agents present", agents > 0, `${agents} agents`);
  }
}

/**
 * Start the server the way the client would and ask it for its tools.
 * HOME points at the throwaway home so a fallback data dir never reaches
 * your real ~/.glean.
 * @param {string} client
 * @param {{ command: string, args: string[], env?: Record<string, string> }} server
 * @param {string | undefined} cwd
 * @param {string} home
 */
async function checkMcp(client, server, cwd, home) {
  const env = {
    ...process.env,
    ...(server.env ?? {}),
    HOME: home,
    USERPROFILE: home,
  };
  try {
    const tools = await listTools(server.command, server.args, { cwd, env });
    record(
      client,
      "MCP initialize + tools/list",
      tools.length > 0,
      `${tools.length} tools`,
    );
  } catch (err) {
    record(
      client,
      "MCP initialize + tools/list",
      false,
      String(err instanceof Error ? err.message : err),
    );
  }
}

/**
 * @param {string} command
 * @param {string[]} argv
 * @param {{ cwd?: string, env: NodeJS.ProcessEnv }} opts
 * @returns {Promise<string[]>}
 */
function listTools(command, argv, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, {
      ...opts,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buffer = "";
    let stderr = "";
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            `no tools/list reply in ${MCP_TIMEOUT_MS}ms. ${stderr.trim().slice(-300)}`,
          ),
        ),
      MCP_TIMEOUT_MS,
    );
    /** @param {Error | null} err @param {string[]} [tools] */
    function finish(err, tools) {
      clearTimeout(timer);
      child.kill();
      if (err) reject(err);
      else resolve(tools ?? []);
    }
    /** @param {object} msg */
    const send = (msg) =>
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);

    child.on("error", (err) => finish(err));
    child.on("exit", (code) =>
      finish(
        new Error(`server exited with ${code}. ${stderr.trim().slice(-300)}`),
      ),
    );
    child.stderr.on("data", (d) => (stderr += d));
    child.stdout.on("data", (d) => {
      buffer += d;
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1) {
          if (msg.error)
            return finish(new Error(`initialize: ${msg.error.message}`));
          send({ method: "notifications/initialized" });
          send({ id: 2, method: "tools/list" });
        } else if (msg.id === 2) {
          if (msg.error)
            return finish(new Error(`tools/list: ${msg.error.message}`));
          finish(
            null,
            (msg.result?.tools ?? []).map((t) => t.name),
          );
        }
      }
    });

    send({
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "e2e-install", version: "0" },
      },
    });
  });
}

// --- helpers ---------------------------------------------------------------

/**
 * Run a CLI step and record it.
 * @param {string} client @param {string} check @param {string} bin
 * @param {string[]} argv @param {NodeJS.ProcessEnv} env
 */
function step(client, check, bin, argv, env) {
  const r = run(bin, argv, env);
  const out = (r.stdout + r.stderr)
    .split("\n")
    .filter((l) => l && !l.startsWith("npm warn"));
  record(client, check, r.ok, out.at(-1) ?? "");
  return r.ok;
}

/** @param {string} bin @param {string[]} argv @param {NodeJS.ProcessEnv} env */
function run(bin, argv, env) {
  const r = spawnSync(bin, argv, {
    env,
    encoding: "utf8",
    cwd: os.tmpdir(),
    timeout: 300_000,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: (r.stderr ?? "") + (r.error ? String(r.error) : ""),
  };
}

/** @param {string} client @param {string} check @param {boolean} ok @param {string} detail */
function record(client, check, ok, detail) {
  results.push({ client, check, ok, detail });
}

function report() {
  const width = Math.max(
    ...results.map((r) => `${r.client}  ${r.check}`.length),
  );
  console.log(`Source: ${source}${args.ref ? ` @ ${args.ref}` : ""}\n`);
  for (const r of results) {
    const label = `${r.client}  ${r.check}`.padEnd(width);
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${label}  ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
}

/** @param {string} dir */
function newestDir(dir) {
  if (!fs.existsSync(dir)) return undefined;
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return entries[0];
}

/** @param {string} dir @param {(name: string) => boolean} match */
function countFiles(dir, match) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (e.isFile() && match(e.name)) n++;
  }
  return n;
}

/** @param {string} s */
function looksLocal(s) {
  return s.startsWith(".") || s.startsWith("/") || fs.existsSync(s);
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const out = {
    source: "dist/agent-plugins",
    ref: "",
    clients: "codex,copilot",
    keep: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep") out.keep = true;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--ref") out.ref = argv[++i];
    else if (a === "--clients") out.clients = argv[++i];
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return out;
}
