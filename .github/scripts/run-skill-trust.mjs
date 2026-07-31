#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const scanner = resolve(process.argv[2] || "");
const outputDir = resolve(process.argv[3] || "skill-trust-results");
const enforce = process.env.SCAN_ENFORCE === "true";

if (!process.argv[2]) throw new Error("usage: run-skill-trust.mjs <dist/cli.js> [output-dir]");

const tracked = execFileSync("git", ["ls-files", "*SKILL.md"], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean)
  .filter((file) => !file.split("/").some((part) => ["dist", "node_modules"].includes(part)))
  .sort();
const targets = [...new Set(tracked.map(dirname))];
if (!targets.length) throw new Error("No tracked SKILL.md targets discovered");

mkdirSync(outputDir, { recursive: true });
const scans = [];
const sarifRuns = [];

for (const target of targets) {
  const run = (format) => spawnSync(process.execPath, [scanner, "verify", target, "--format", format], {
    encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  });
  const jsonRun = run("json");
  const sarifRun = run("sarif");
  let result;
  let error;
  try { result = JSON.parse(jsonRun.stdout); }
  catch { error = (jsonRun.stderr || jsonRun.stdout || `scanner exited ${jsonRun.status}`).trim(); }

  try {
    const sarif = JSON.parse(sarifRun.stdout);
    for (const sarifRunResult of sarif.runs || []) {
      for (const finding of sarifRunResult.results || []) {
        for (const location of finding.locations || []) {
          const artifact = location.physicalLocation?.artifactLocation;
          if (artifact?.uri) artifact.uri = `${target}/${artifact.uri}`;
        }
      }
      sarifRunResult.automationDetails = { id: `skill-trust/${target}/` };
      sarifRuns.push(sarifRunResult);
    }
  } catch {
    if (!error) error = (sarifRun.stderr || sarifRun.stdout || "invalid SARIF output").trim();
  }
  scans.push({ target, exitCode: jsonRun.status, result, error });
}

const totals = scans.reduce((sum, scan) => {
  sum.targets++;
  if (scan.result) {
    sum[scan.result.level.toLowerCase()]++;
    sum.errors += scan.result.summary.errors;
    sum.warnings += scan.result.summary.warnings;
    sum.info += scan.result.summary.info;
  } else sum.scanErrors++;
  return sum;
}, { targets: 0, verified: 0, partial: 0, undeclared: 0, inconsistent: 0, errors: 0, warnings: 0, info: 0, scanErrors: 0 });

writeFileSync(`${outputDir}/results.json`, JSON.stringify({ scanner: "skill-trust@331545d5c7ee85ed18234599b1b1451a33457ca4", enforce, totals, scans }, null, 2));
writeFileSync(`${outputDir}/results.sarif`, JSON.stringify({ version: "2.1.0", $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs: sarifRuns }, null, 2));

const rows = scans.map(({ target, result, error }) => `| \`${target}\` | ${result?.level || "SCAN_ERROR"} | ${result?.summary.errors ?? "-"} | ${result?.summary.warnings ?? "-"} | ${result?.summary.info ?? "-"} | ${error ? error.replaceAll("|", "\\|").replaceAll("\n", " ") : ""} |`);
const summary = [
  "## AI Skill security scan", "",
  `Audit-only: **${enforce ? "no (enforcement enabled)" : "yes"}**`, "",
  `Discovered **${totals.targets}** Skill targets: ${totals.verified} verified, ${totals.partial} partial, ${totals.undeclared} undeclared, ${totals.inconsistent} inconsistent, ${totals.scanErrors} scan errors.`, "",
  `Findings: **${totals.errors} errors**, **${totals.warnings} warnings**, **${totals.info} informational**.`, "",
  "| Target | Classification | Errors | Warnings | Info | Scan error |", "|---|---:|---:|---:|---:|---|", ...rows, "",
  "> skill-trust currently analyzes SKILL.md trust declarations and executable code within each Skill. Plugin manifests, agent prompts, rules, and standalone scripts are inventoried in SECURITY-SCANNING.md but are not supported by this scanner.", "",
].join("\n");
writeFileSync(`${outputDir}/summary.md`, summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);

if (enforce && (totals.errors > 0 || totals.inconsistent > 0 || totals.scanErrors > 0)) process.exitCode = 1;
