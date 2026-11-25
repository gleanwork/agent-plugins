#!/usr/bin/env node
// Prints a Markdown summary of the newest run of each Claude skill eval.
//
//   node evals/claude/summarize.mjs [--candidate "<what the candidate was>"] > evals/results/<name>.md
//
// It reads each run's results.json, so the numbers are the ones MST graded.
// It adds one check MST has no grader for: whether the answer sends the user
// to the relay's `setup` tool on a server that has no such tool.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const results = path.join(here, "..", ".mcp-test-results");
const builds = JSON.parse(fs.readFileSync(path.join(here, ".build", "builds.json"), "utf8"));
const SHAPES = ["relay", "relay-first-run", "direct", "proxy", "no-discovery", "no-glean"];
const VARIANTS = ["baseline", "candidate"];
const NAMES_SETUP = /`setup`|[Ss]et up Glean for me/;

const noteAt = process.argv.indexOf("--candidate");
const candidateNote = noteAt >= 0 ? process.argv[noteAt + 1] : builds.candidate.source;

function newestRun(shape) {
  const runs = path.join(results, `glean-skills-claude-${shape}`, "runs");
  if (!fs.existsSync(runs)) return undefined;
  // A run narrowed by --case or --trials is not a result to publish.
  const full = fs
    .readdirSync(runs)
    .sort()
    .filter((id) => {
      const run = path.join(runs, id, "run.json");
      return fs.existsSync(run) && !JSON.parse(fs.readFileSync(run, "utf8")).partial;
    });
  const id = full.at(-1);
  if (!id) return undefined;
  const dir = path.join(runs, id);
  return {
    id,
    run: JSON.parse(fs.readFileSync(path.join(dir, "run.json"), "utf8")),
    cases: JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8")).cases,
  };
}

const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const count = (values, test) => values.filter(test).length;
const share = (n, of) => `${n}/${of}`;

function trialStats(trial) {
  const events = trial.transcript?.events ?? [];
  const startup = trial.clientDiagnostics?.claudeStartup;
  return {
    pass: trial.pass === true,
    mcpCalls: count(events, (e) => e.kind === "tool_call" && e.source === "mcp"),
    namesSetup: NAMES_SETUP.test(trial.transcript?.finalText ?? ""),
    cost: trial.clientUsage?.totalCostUsd ?? 0,
    seconds: (trial.durationMs ?? 0) / 1000,
    model: startup?.model,
    claudeCode: startup?.version,
    hasSetupTool: (startup?.servers ?? []).some((server) =>
      (server.tools ?? []).some((tool) => /(^|_)setup$/.test(tool)),
    ),
  };
}

const lines = [];
const summary = [];
const sections = [];
const seen = { models: new Set(), claudeCode: new Set(), mst: new Set(), trials: new Set(), dates: new Set() };

for (const shape of SHAPES) {
  const run = newestRun(shape);
  if (!run) continue;
  seen.mst.add(run.run.mst?.version);
  seen.dates.add(String(run.run.createdAt).slice(0, 10));

  const byCase = new Map();
  for (const entry of run.cases) {
    const trials = entry.trialResults.map(trialStats);
    for (const trial of trials) {
      if (trial.model) seen.models.add(trial.model);
      if (trial.claudeCode) seen.claudeCode.add(trial.claudeCode);
    }
    seen.trials.add(trials.length);
    if (!byCase.has(entry.id)) byCase.set(entry.id, {});
    byCase.get(entry.id)[entry.variant] = { pass: entry.pass === true, trials };
  }

  const all = (variant) => [...byCase.values()].flatMap((c) => c[variant]?.trials ?? []);
  const hasSetupTool = all("baseline").some((trial) => trial.hasSetupTool);

  for (const variant of VARIANTS) {
    const trials = all(variant);
    const casesOf = [...byCase.values()].filter((c) => c[variant]);
    summary.push(
      `| \`${shape}\` | ${variant} | ${share(count(casesOf, (c) => c[variant].pass), casesOf.length)} ` +
        `| ${share(count(trials, (t) => t.pass), trials.length)} ` +
        `| ${mean(trials.map((t) => t.mcpCalls)).toFixed(1)} ` +
        (hasSetupTool ? "| n/a " : `| ${share(count(trials, (t) => t.namesSetup), trials.length)} `) +
        `| $${mean(trials.map((t) => t.cost)).toFixed(3)} ` +
        `| ${mean(trials.map((t) => t.seconds)).toFixed(1)} s |`,
    );
  }

  const header = hasSetupTool
    ? ["Case", "Baseline passed", "Candidate passed", "Baseline calls", "Candidate calls"]
    : ["Case", "Baseline passed", "Candidate passed", "Baseline calls", "Candidate calls", "Baseline names `setup`", "Candidate names `setup`"];
  const rows = [...byCase.entries()].map(([id, c]) => {
    const cell = (variant, pick) => (c[variant] ? pick(c[variant].trials) : "-");
    const passed = (trials) => share(count(trials, (t) => t.pass), trials.length);
    const calls = (trials) => mean(trials.map((t) => t.mcpCalls)).toFixed(1);
    const names = (trials) => share(count(trials, (t) => t.namesSetup), trials.length);
    const cells = [
      `\`${id}\``,
      cell("baseline", passed),
      cell("candidate", passed),
      cell("baseline", calls),
      cell("candidate", calls),
      ...(hasSetupTool ? [] : [cell("baseline", names), cell("candidate", names)]),
    ];
    return `| ${cells.join(" | ")} |`;
  });
  sections.push(
    `## \`${shape}\``,
    "",
    `Run \`${run.id}\`.`,
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
  );
}

const list = (set) => [...set].filter(Boolean).join(", ");
lines.push(
  `# Claude skill eval, ${list(seen.dates)}`,
  "",
  `- **Baseline:** \`glean\` ${builds.baseline.version}, from ${builds.baseline.source}.`,
  `- **Candidate:** \`glean\` ${builds.candidate.version}, ${candidateNote}.`,
  `- **Host:** Claude Code ${list(seen.claudeCode)}, model \`${list(seen.models)}\`.`,
  `- **Harness:** MCP Server Tester ${list(seen.mst)}, ${list(seen.trials)} trials for each case.`,
  "",
  "See [the README](../README.md) for the method, the server shapes and the limits.",
  "",
  "## Summary",
  "",
  "A case passes when every one of its trials passes. Calls, cost and time are means for one trial.",
  "\"Names `setup`\" counts the answers that send the user to the relay's `setup` tool on a server that has no such tool.",
  "",
  "| Shape | Build | Cases passed | Trials passed | MCP calls | Names `setup` | Cost | Time |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...summary,
  "",
  ...sections,
);
process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
