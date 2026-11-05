---
name: glean
description: Default way to answer any question about the user's company with Glean - docs, Slack, email, tickets, people, meetings, decisions, projects, or the user's own work. Use for "/glean", "ask Glean", "what's our policy on", "who owns", "what was decided", "what am I working on". Gives a cited, up-to-date answer in the fewest Glean tool calls. Not for the local codebase, the public web, or general knowledge.
---

# Glean

Answer from the user's company knowledge, grounded in sources, using the fewest tool calls that still give a complete answer.

## Pick the cheapest tool that answers

Glean tools come from the user's Glean MCP server (`mcp__glean_<server>__<tool>`). Use whichever are available. If none are, ask the user to set up Glean.

- Docs, wikis, Slack, tickets: `search`. Add filters (`owner:`, `from:`, `updated:`, `after:`, app) in place of a broader query.
- People, owners, teams, reporting lines: `employee_search`. Never `search`.
- Meetings, decisions, action items: `meeting_lookup`.
- The user's own role, projects, preferences and recent work: `memory` and `user_activity`. Check `memory` first when the answer depends on who is asking.
- A URL the user gave, or a result whose snippet isn't enough: `read_document`. Read only what you will cite.
- A question that needs reasoning across many sources: `chat`, once, instead of many searches.

## Work cheaply

1. Run independent calls in parallel.
2. Start narrow. Broaden only if results are empty or off-topic, and re-run at most twice with different keywords.
3. Stop once the question is answered. Don't fetch extra pages to be thorough.

## Answer well

- Lead with the answer, then the supporting points.
- Cite every claim with its source link. No link, no claim.
- Prefer recent sources and say when one is old or when sources disagree.
- Empty results can mean the user has no access. Say so, and don't guess or pad.
