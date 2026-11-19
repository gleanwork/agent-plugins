import { test } from "node:test";
import assert from "node:assert/strict";
import { checkText } from "./check-skill-tool-names.mjs";

const SKILL = "shared/glean/skills/example/SKILL.md";
const lines = (problems) => problems.map((p) => p.line);

test("core tools may be named anywhere", () => {
  const text = "Use `search`, then `read_document`. Ask `chat`. Find people with `employee_search`.\n";
  assert.deepEqual(checkText(SKILL, text), []);
});

test("an optional tool without a condition is flagged", () => {
  const text = "# Skill\n\nStart with `code_search` on the best keyword.\n";
  const problems = checkText(SKILL, text);
  assert.deepEqual(lines(problems), [3]);
  assert.match(problems[0].message, /`code_search`/);
});

test("a condition in the same paragraph allows the tool", () => {
  const text = [
    "# Skill",
    "",
    "## Steps",
    "",
    "If `code_search` is available, start with it.",
    "",
    "Use `meeting_lookup` for decisions when it is in your tool list;",
    "otherwise use `search`.",
  ].join("\n");
  assert.deepEqual(checkText(SKILL, text), []);
});

test("a condition in another paragraph does not count", () => {
  const text = "## Steps\n\nIf `code_search` is available, use it.\n\nThen narrow `code_search` with filters.\n";
  assert.deepEqual(lines(checkText(SKILL, text)), [5]);
});

test("a condition about something else does not count", () => {
  const text = [
    "## Tools",
    "",
    "Delegate to a subagent when subagents are available. For pitfalls of",
    "`meeting_lookup`, see the reference.",
  ].join("\n");
  assert.deepEqual(lines(checkText(SKILL, text)), [3]);
});

test("a conditional sentence covers later sentences in its paragraph", () => {
  const text = "## Steps\n\nIf `code_search` is available, start there. Narrow `code_search` with filters.\n";
  assert.deepEqual(checkText(SKILL, text), []);
});

test("each list item and table row is checked on its own", () => {
  const text = [
    "## Steps",
    "",
    "- Use `gmail_search` if it is available.",
    "- Use `outlook_search` for mail.",
    "",
    "| Need | Tool |",
    "|---|---|",
    "| Mail | `gmail_search`, if available |",
    "| Meetings | `meeting_lookup` |",
  ].join("\n");
  assert.deepEqual(lines(checkText(SKILL, text)), [4, 9]);
});

test("an 'if available' heading covers its section only", () => {
  const text = [
    "## Other tools, if available",
    "",
    "| Meetings | `meeting_lookup` |",
    "",
    "### Notes",
    "",
    "`user_activity` returns views and edits.",
    "",
    "## Rules",
    "",
    "Use `memory` for preferences.",
  ].join("\n");
  assert.deepEqual(lines(checkText(SKILL, text)), [11]);
});

test("a condition in the opening text covers the whole file", () => {
  const text = [
    "# Code skill",
    "",
    "Use this skill only when `code_search` is in your tool list.",
    "",
    "## Steps",
    "",
    "Start with `code_search`.",
    "Narrow `memory` results.",
  ].join("\n");
  assert.deepEqual(lines(checkText(SKILL, text)), [7]);
});

test("a reference file may name its own tools", () => {
  const text = "# Memory\n\nCall `memory_schema`, then `memory`. Compare with `user_activity`.\n";
  const problems = checkText("shared/glean/skills/using-glean/reference/memory.md", text);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /`user_activity`/);
});

test("fenced code blocks are ignored", () => {
  const text = "## Example\n\n```\n`code_search`(\"x\")\n```\n";
  assert.deepEqual(checkText(SKILL, text), []);
});

test("the frontmatter description is checked", () => {
  const text = "---\nname: x\ndescription: Uses `meeting_lookup` to prep.\n---\n\n# X\n";
  assert.deepEqual(lines(checkText(SKILL, text)), [1]);
});

test("host-specific prefixes are flagged", () => {
  const text = "Call `mcp__glean_default__search`.\n";
  const problems = checkText(SKILL, text);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /host-specific/);
});

test("names outside backticks are not tool names", () => {
  const text = "## Rules\n\nPersonalize via memory and meeting lookups.\n";
  assert.deepEqual(checkText(SKILL, text), []);
});
