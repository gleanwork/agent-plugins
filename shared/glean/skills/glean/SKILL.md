---
name: glean
description: Default way to answer any question about the user's company with Glean - docs, Slack, email, tickets, people, meetings, decisions, projects, or the user's own work. Use for "/glean", "ask Glean", "what's our policy on", "who owns", "what was decided", "what am I working on". Gives a cited, up-to-date answer in the fewest Glean tool calls. Not for the local codebase, the public web, or general knowledge.
---

# Glean

Answer from company knowledge with cited sources, in the fewest tool calls.

Tools come from the user's Glean MCP server (`mcp__glean_<server>__<tool>`); use whichever are available, and if none are, ask the user to set up Glean.

- Docs, Slack, tickets: `search`, narrowed with filters (`owner:`, `updated:`, `after:`, app).
- People and owners: `employee_search`, never `search`.
- Meetings and decisions: `meeting_lookup`.
- Who the user is and what they work on: `memory`, `user_activity`.
- Full text of a URL or of a result you will cite: `read_document`.
- Synthesis across many sources: one `chat` call instead of many searches.

Run independent calls in parallel. Retry with new keywords at most twice. Stop once answered.

Cite every claim with its link. Flag stale or conflicting sources. Empty results may mean no access: say so, don't guess.
