#!/usr/bin/env node
// Check how skills name Glean MCP tools.
//
// The tools a Glean MCP server serves come from its `tools/list`, and that
// list differs between deployments: admins add and remove toolsets, and some
// deployments serve a tool under another name. A skill can't know the list,
// so it must not read as if it does. The rules:
//
// 1. A core tool (CORE_TOOLS) may be named anywhere. These are on nearly
//    every deployment.
// 2. Any other known Glean tool (OPTIONAL_TOOLS) may be named only where the
//    text says the tool might be missing, so the agent has a fallback:
//    - in a paragraph, list item or table row that has a sentence naming the
//      tool with an availability condition ("if `code_search` is
//      available", "use `meeting_lookup` when it is in your tool list"),
//    - under a heading that says "if available",
//    - anywhere in a file whose opening text (before the first `##` heading)
//      names the tool with a condition, or
//    - in the tool's own reference file (`reference/code-search.md` for
//      `code_search`, `reference/memory.md` for `memory` and `memory_schema`).
// 3. No host-specific tool prefixes such as `mcp__glean_default__search`.
//    Hosts name MCP tools differently; skills use the bare tool name.
//
// Only names in backticks count as tool names. Add new Glean tool names to
// OPTIONAL_TOOLS when they ship.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const CORE_TOOLS = new Set([
  "search",
  "chat",
  "read_document",
  "employee_search",
]);

export const OPTIONAL_TOOLS = new Set([
  "enterprise_search",
  "code_search",
  "meeting_lookup",
  "gmail_search",
  "outlook_search",
  "user_activity",
  "memory",
  "memory_schema",
  "knowledge_graph_query",
  "knowledge_graph_schema",
]);

const SCAN_ROOTS = ["shared", "overrides"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

// "if `x` is available", "when it is missing", "if your tool list has it",
// "where the deployment serves `x`".
const CONDITION =
  /\b(if|when|where|unless)\b[^.!?]*?\b(available|missing|tool list|tools\/list|serves?|offers?)\b/i;
const CONDITION_HEADING = /\bif available\b/i;
const HOST_PREFIX = /mcp__glean/;
const INLINE_CODE = /`([^`\n]+)`/g;

/** Tool names in backticks in `text`, in order, without duplicates. */
function toolNames(text) {
  const names = [];
  for (const match of text.matchAll(INLINE_CODE)) {
    const name = match[1].trim();
    if (OPTIONAL_TOOLS.has(name) && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Tools named in a sentence of `text` that also states an availability condition. */
function conditionalTools(text) {
  const covered = new Set();
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (CONDITION.test(sentence)) {
      for (const name of toolNames(sentence)) covered.add(name);
    }
  }
  return covered;
}

/** Tools a reference file is about: `memory.md` covers `memory` and `memory_*`. */
function ownTools(filePath) {
  const match = /(?:^|[\\/])reference[\\/]([a-z0-9-]+)\.md$/.exec(filePath);
  if (!match) return new Set();
  const stem = match[1].replaceAll("-", "_");
  return new Set(
    [...OPTIONAL_TOOLS].filter((t) => t === stem || t.startsWith(stem + "_")),
  );
}

/**
 * Split Markdown into checkable units: paragraphs, list items and table rows,
 * each with its first line number and the "if available" heading scope it
 * sits in. Fenced code blocks are skipped.
 */
function units(lines, firstLine) {
  const out = [];
  const headings = []; // stack of { level, conditional }
  let current = null;
  let inFence = false;
  let beforeFirstH2 = true;

  const flush = () => {
    if (current) out.push(current);
    current = null;
  };
  const conditionalScope = () => headings.some((h) => h.conditional);

  lines.forEach((line, i) => {
    const lineNo = firstLine + i;
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      while (headings.length && headings.at(-1).level >= level) headings.pop();
      headings.push({ level, conditional: CONDITION_HEADING.test(heading[2]) });
      if (level === 2) beforeFirstH2 = false;
      return;
    }
    if (line.trim() === "") {
      flush();
      return;
    }

    const isTableRow = /^\s*\|/.test(line);
    const isListItem = /^\s*([-*+]|\d+[.)])\s+/.test(line);
    if (isTableRow || isListItem || !current || current.table) flush();
    if (!current) {
      current = {
        line: lineNo,
        text: "",
        table: isTableRow,
        conditional: conditionalScope(),
        opening: beforeFirstH2,
      };
    }
    current.text += (current.text ? " " : "") + line.trim();
  });
  flush();
  return out;
}

/** Split off YAML frontmatter. Returns the description and the body lines. */
function splitFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return { description: null, body: lines, bodyStart: 1 };
  const end = lines.indexOf("---", 1);
  if (end === -1) return { description: null, body: lines, bodyStart: 1 };
  let description = null;
  try {
    const data = YAML.parse(lines.slice(1, end).join("\n"));
    if (data && typeof data.description === "string") description = data.description;
  } catch {
    // Malformed frontmatter is pluginpack's problem, not this check's.
  }
  return { description, body: lines.slice(end + 1), bodyStart: end + 2 };
}

/** Problems in one Markdown file, as { line, message }. */
export function checkText(filePath, text) {
  const problems = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (HOST_PREFIX.test(line)) {
      problems.push({
        line: i + 1,
        message:
          "host-specific tool prefix (`mcp__glean...`). Name the tool by its bare name.",
      });
    }
  });

  const own = ownTools(filePath);
  const { description, body, bodyStart } = splitFrontmatter(text);
  const all = units(body, bodyStart);
  if (description !== null) {
    all.unshift({ line: 1, text: description, conditional: false, opening: false });
  }

  // A conditional mention in the opening text covers the whole file.
  const fileWide = new Set(own);
  for (const unit of all) {
    if (unit.opening) {
      for (const name of conditionalTools(unit.text)) fileWide.add(name);
    }
  }

  for (const unit of all) {
    if (unit.conditional) continue;
    const covered = conditionalTools(unit.text);
    for (const name of toolNames(unit.text)) {
      if (fileWide.has(name) || covered.has(name)) continue;
      problems.push({
        line: unit.line,
        message:
          `\`${name}\` is named without saying it may be missing. ` +
          `Add a condition ("if \`${name}\` is available, ...; otherwise ...") ` +
          `or move it under an "If available" heading.`,
      });
    }
  }
  return problems.sort((a, b) => a.line - b.line);
}

function skillFiles(dir, out, inSkills = false) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        skillFiles(abs, out, inSkills || entry.name === "skills");
      }
    } else if (inSkills && entry.isFile() && entry.name.endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

function main() {
  const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
  const files = SCAN_ROOTS.flatMap((root) =>
    skillFiles(path.join(repoRoot, root), []),
  ).sort();

  let count = 0;
  for (const file of files) {
    const rel = path.relative(repoRoot, file);
    for (const p of checkText(rel, fs.readFileSync(file, "utf8"))) {
      console.error(`${rel}:${p.line}: ${p.message}`);
      count++;
    }
  }
  if (count > 0) {
    console.error(
      `\n${count} problem(s). Glean's tools/list is the only full list of tools; ` +
        `see the rules at the top of scripts/check-skill-tool-names.mjs.`,
    );
    process.exit(1);
  }
  console.log(`Skill tool names OK (${files.length} files).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
