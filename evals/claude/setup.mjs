#!/usr/bin/env node
// Prepares a skill eval that compares two builds of the Claude plugin.
//
//   node evals/claude/setup.mjs --candidate <marketplace dir> [--baseline <marketplace dir>]
//
// A "marketplace dir" is a built Claude output: the directory that holds
// .claude-plugin/marketplace.json, such as dist/claude after `npm run build`.
// Without --baseline, the baseline is the published plugin at BASELINE_COMMIT
// of gleanwork/claude-plugins.
//
// For each build it makes a Claude Code config directory with the `glean`
// plugin installed the way a user installs it, then writes one eval config per
// server shape into .build/. Each config has two variants that differ only in
// which config directory Claude Code runs with.
//
// The model can see the paths of the plugin it runs. So each build is copied
// to a directory whose path says nothing about the eval or about which build
// it is: <work dir>/1 for the baseline and <work dir>/2 for the candidate. The
// work dir is ~/.cache/glean-plugins unless --work-dir names another.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASELINE_REPO = "https://github.com/gleanwork/claude-plugins";
const BASELINE_COMMIT = "2b1d443"; // the sync commit for agent-plugins v3.6.2
const MODEL = "claude-sonnet-5-5";
const TRIALS = 5;

const here = path.dirname(fileURLToPath(import.meta.url));
const build = path.join(here, ".build");
const servers = path.join(here, "servers");
const cases = path.join(here, "cases");

function option(name) {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: ["ignore", "pipe", "inherit"], ...options })
    .toString()
    .trim();
}

function marketplace(dir, label) {
  const manifest = path.join(dir, ".claude-plugin", "marketplace.json");
  if (!fs.existsSync(manifest)) {
    throw new Error(`${label}: no .claude-plugin/marketplace.json in ${dir}`);
  }
  const name = JSON.parse(fs.readFileSync(manifest, "utf8")).name;
  const plugin = path.join(dir, "plugins", "glean");
  const version = JSON.parse(
    fs.readFileSync(path.join(plugin, ".claude-plugin", "plugin.json"), "utf8"),
  ).version;
  return { dir, name, plugin, version };
}

function fetchBaseline() {
  const dir = path.join(build, "baseline");
  if (!fs.existsSync(dir)) run("git", ["clone", "--quiet", BASELINE_REPO, dir]);
  run("git", ["-C", dir, "checkout", "--quiet", BASELINE_COMMIT]);
  return dir;
}

/** Copy a build to a neutral path and read its manifest there. */
function stage(slot, from, label) {
  marketplace(from, label);
  const dir = path.join(workDir, slot, "marketplace");
  fs.rmSync(path.join(workDir, slot), { recursive: true, force: true });
  fs.cpSync(from, dir, {
    recursive: true,
    filter: (file) => path.basename(file) !== ".git",
  });
  return marketplace(dir, label);
}

/** A Claude Code config directory with the build's `glean` plugin installed. */
function install(slot, source) {
  const configDir = path.join(workDir, slot, "claude");
  fs.mkdirSync(configDir, { recursive: true });
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  run("claude", ["plugin", "marketplace", "add", source.dir], { env });
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source.plugin, ".claude-plugin", "plugin.json"), "utf8"),
  );
  // A build that asks the user for its server URL gets a placeholder. The
  // eval names the server itself, so Claude Code never connects to this one.
  const config = manifest.userConfig?.server_url
    ? ["--config", "server_url=https://glean.invalid/mcp/default"]
    : [];
  run("claude", ["plugin", "install", `glean@${source.name}`, ...config], { env });
  return configDir;
}

const candidateDir = option("--candidate");
if (!candidateDir) {
  console.error("usage: setup.mjs --candidate <marketplace dir> [--baseline <marketplace dir>]");
  process.exit(2);
}
fs.mkdirSync(build, { recursive: true });
const workDir = path.resolve(
  option("--work-dir") ?? path.join(os.homedir(), ".cache", "glean-plugins"),
);

const baseline = stage(
  "1",
  path.resolve(option("--baseline") ?? fetchBaseline()),
  "baseline",
);
const candidate = stage("2", path.resolve(candidateDir), "candidate");
const configDirs = {
  baseline: install("1", baseline),
  candidate: install("2", candidate),
};

const stub = (shape) => ({
  transport: "stdio",
  command: process.execPath,
  args: [path.join(servers, "glean-stub.mjs"), "--shape", shape],
});

// Each shape is a tool list the plugin can meet. The server is always labelled
// `glean`, so the model sees the same tool names in every shape.
const shapes = {
  // Today: the plugin's local relay in front of Glean. The relay is the
  // baseline build's in both variants, because the candidate may not ship one.
  relay: {
    server: {
      transport: "stdio",
      command: process.execPath,
      args: [path.join(servers, "relay.mjs"), "--plugin", baseline.plugin],
    },
    writes: "unguarded",
    datasets: ["discovery.json", "regression.json"],
  },
  // Today, straight after install: the relay has no server URL and no token.
  "relay-first-run": {
    server: {
      transport: "stdio",
      command: process.execPath,
      args: [path.join(servers, "relay.mjs"), "--plugin", baseline.plugin, "--first-run"],
    },
    writes: "unguarded",
    datasets: ["first-run.json"],
  },
  // Claude Code connected to a Glean server that offers skill discovery.
  direct: {
    server: stub("direct"),
    writes: "unguarded",
    datasets: ["discovery.json", "regression.json"],
  },
  // Claude Code connected to the plugin's own endpoint with no relay: what a
  // user has after an update that keeps their saved server URL.
  proxy: {
    server: stub("proxy"),
    writes: "unguarded",
    datasets: ["discovery.json", "regression.json"],
  },
  // A Glean server whose admin has not enabled skill discovery.
  "no-discovery": { server: stub("no-discovery"), datasets: ["no-discovery.json"] },
  // No Glean server: the URL is unset or the user has not signed in.
  "no-glean": { server: stub("unrelated"), label: "units", datasets: ["no-glean.json"] },
};

const variant = (name, configDir) => ({
  name,
  clientOptions: { env: { CLAUDE_CONFIG_DIR: configDir } },
});

for (const [shape, spec] of Object.entries(shapes)) {
  const label = spec.label ?? "glean";
  const config = {
    name: `glean-skills-claude-${shape}`,
    datasets: spec.datasets.map((file) => path.join(cases, file)),
    servers: { [label]: spec.server },
    ...(spec.writes ? { writes: { [label]: spec.writes } } : {}),
    client: "claude-code",
    model: MODEL,
    trials: TRIALS,
    redactStoredResponses: false,
    metrics: [
      "passed",
      "trial_pass",
      "mcp_call_count",
      "builtin_event_count",
      "input_tokens",
      "output_tokens",
      "cost_usd",
      "duration_s",
    ],
    variants: [
      variant("baseline", configDirs.baseline),
      variant("candidate", configDirs.candidate),
    ],
  };
  fs.writeFileSync(
    path.join(build, `${shape}.eval.json`),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

fs.writeFileSync(
  path.join(build, "builds.json"),
  `${JSON.stringify(
    {
      model: MODEL,
      claudeCode: run("claude", ["--version"]),
      baseline: { version: baseline.version, source: option("--baseline") ?? `${BASELINE_REPO}@${BASELINE_COMMIT}` },
      candidate: { version: candidate.version, source: path.resolve(candidateDir) },
    },
    null,
    2,
  )}\n`,
);

console.log(`baseline   ${baseline.version}  ${baseline.dir}`);
console.log(`candidate  ${candidate.version}  ${candidate.dir}`);
console.log(`work dir   ${workDir}`);
console.log(`eval configs in ${build}: ${Object.keys(shapes).join(", ")}`);
