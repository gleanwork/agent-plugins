---
name: skill-creation-guide
description: Discover and vet reusable skill opportunities from the user's Glean work patterns. Use when the user asks "what should I automate", "find skill opportunities", or wants to turn recurring work into skills. For authoring a known skill in Codex, hand off to the built-in skill-creator.
---

# Skill Creation Guide

Help the user identify valuable agent-skill opportunities from Glean context.
Vet candidates carefully, then hand actual authoring to Codex's built-in
`$skill-creator`.

## BE SKEPTICAL

Not every idea makes a good skill. Evaluate before creating:

**Recurrence** — Will this be used repeatedly?
- ✅ Weekly or more → create
- ⚠️ Monthly → reconsider, may not be worth it
- ❌ One-time → skip

**Automation** — Can it actually be automated?
- ✅ Clear, repeatable process → create
- ⚠️ Needs significant judgment each time → reconsider
- ❌ Too context-dependent, each case unique → skip

**Value** — Is the cumulative time saved significant?
- ✅ Meaningful savings per use → create
- ❌ Slower to invoke than doing manually → skip

**Duplication** — Does it already exist?
- ✅ Novel, unaddressed need → create
- ⚠️ Similar to an existing skill → enhance that instead
- ❌ Already covered → skip

Don't create skills for one-time events, tasks that differ fundamentally each
time, sub-30-second manual tasks, or things the user will forget exist.

## Workflow A — Discover opportunities

When the user asks what they should automate, analyze their work patterns first.

Requires the Glean MCP tools. If they aren't visible, the user hasn't connected
a Glean MCP server — point them at the **connect-glean** skill.

1. Gather context with Glean: `memory` (roles, responsibilities, active
   projects), `user_activity` (past ~2 weeks), and `search` for process docs
   (`"runbook OR checklist OR process owner:me"`).
2. If subagent tools are available, delegate this analysis to a general
   subagent with the gathered context and recurrence/value tests. Otherwise
   analyze the patterns directly in the current task.
3. Present vetted recommendations grouped by cumulative value, and show the
   rejected candidates with reasons. A few high-quality candidates beat many
   weak ones — "no automatable patterns" is a valid outcome.

See `using-glean/reference/` for the param shape of `memory`, `user_activity`,
and `search`.

## Workflow B — Generate a skill

When the user selects a candidate or already has a specific skill in mind:

1. Pass the vetted concept, requirements, available-tools context, and relevant
   Glean findings to `$skill-creator`.
2. Let `$skill-creator` determine the final structure, files, and installation
   location. Do not duplicate its generation workflow here.

## Related skill

- `$skill-creator` — authors and validates the selected skill for Codex.
