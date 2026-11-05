---
name: glean
description: Answer questions about the company: documents, messages, email, tickets, people, meetings, projects, and the user's own work. Use for questions like "what's the latest on the Q3 launch?", "find the onboarding guide for new sales hires", "who should I talk to about the pricing change?", "prep me for my 2pm meeting", or "what did I work on this week?". Gives a cited, up-to-date answer in as few tool calls as possible.
---

# Glean

Answer from company knowledge with cited sources, in the fewest tool calls.

Tools come from the user's Glean MCP server (`mcp__glean_<server>__<tool>`); use whichever are available, and if none are, ask the user to set up Glean.

- Docs, messages, tickets: `search`, narrowed with filters (`owner:`, `updated:`, `after:`, app).
- People and owners: `employee_search`, never `search`.
- Meetings and decisions: `meeting_lookup`.
- The user's role, projects and recent work: `memory`, `user_activity`.
- Full text of a URL or of a result you will cite: `read_document`.

Run independent calls in parallel. Retry with new keywords at most twice. Stop once answered.

Check `memory` for how the user likes to read answers (length, format, tone) and write to that.

Cite every claim with its link. Flag stale or conflicting sources. Empty results may mean no access: say so, don't guess.
