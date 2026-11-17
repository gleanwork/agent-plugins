---
name: using-glean
description: Use Glean MCP tools to answer questions about company documents, internal wikis, policies, RFCs, design docs, people, teams, meetings, decisions, action items, email, calendar events, internal code, and the user's own work activity. Reach for this whenever the answer lives in enterprise systems rather than the local codebase or public web. Trigger phrases include "find the doc about", "what's our policy on", "where is the spec for", "who works on", "who owns", "find someone who knows", "what was decided in the meeting", "action items from", "search my email", "what did I work on last week", and "find the implementation in our repos". Don't use it for questions answerable from the local working directory, the public web, or generic programming knowledge.
---

# Using Glean

The Glean MCP server gives the assistant tools that query the user's company knowledge: documents, people, meetings, email, code, the user's activity, and more. This skill maps a question to the right tool, gives the rules that apply to every tool, and links to per-tool reference files.

## Which tools you have

The Glean server's tool list (`tools/list`) is the only complete list of the tools you can call. It differs between deployments. Admins add and remove toolsets, and some deployments serve a tool under another name. For example, where `enterprise_search` is in the tool list, it is `search`.

- The tools this skill names are examples, not a full list. Before you plan, check which Glean tools are in your tool list.
- Refer to tools by their bare names. Hosts add their own prefixes; match on the tool name at the end.
- Call only tools you can see. If a tool this skill names is missing, use its fallback, or tell the user that their Glean deployment doesn't offer it.
- Read the description of any Glean tool you don't recognize. It may be a platform agent or a newer tool; see [agents-as-tools.md](reference/agents-as-tools.md).

If no Glean tools are visible, ask the user to set up Glean by prompting the harness (for example, `Set up Glean for me`).

## Core tools

Most deployments serve these.

| The user is asking about... | Reach for | Reference |
|---|---|---|
| Documents, wikis, policies, RFCs, specs, messages, tickets | `search` | [search.md](reference/search.md) |
| A specific URL or document | `read_document` | [read-document.md](reference/read-document.md) |
| A complex question that needs synthesis across sources | `chat` | [chat.md](reference/chat.md) |
| People, teams, org structure, reporting lines | `employee_search` | [employee-search.md](reference/employee-search.md) |

## Other tools, if available

Use these only when they are in your tool list. Otherwise use the fallback.

| The user is asking about... | Tool, if available | Fallback | Reference |
|---|---|---|---|
| Internal source code, files, commits | `code_search` | `search`, and say the results come from document search, not code search | [code-search.md](reference/code-search.md) |
| Meetings, transcripts, decisions, action items | `meeting_lookup` | `search` for meeting notes and recaps | [meeting-lookup.md](reference/meeting-lookup.md) |
| Gmail messages and threads | `gmail_search` | Say that email search isn't available | [gmail-search.md](reference/gmail-search.md) |
| Outlook messages and threads | `outlook_search` | Say that email search isn't available | [outlook-search.md](reference/outlook-search.md) |
| The user's own recent activity | `user_activity` | `search` with `from="me"` and a date filter | [user-activity.md](reference/user-activity.md) |
| The user's stored memories and preferences | `memory` (with `memory_schema`) | Skip personalization | [memory.md](reference/memory.md) |
| Entity and relationship queries | `knowledge_graph_query` (with `knowledge_graph_schema`) | `search` and `employee_search` | [knowledge-graph.md](reference/knowledge-graph.md) |

The reference files load only when needed. Open the relevant one before you call a tool you haven't used recently. Each file has the parameters, the filter syntax, and known pitfalls.

## Cross-tool rules

These apply to every Glean tool.

1. **Don't use `search` for people.** It searches documents and doesn't index people. Use `employee_search`.
2. **Cite every claim with a URL.** Glean returns links; show them so the user can check. A claim with no URL is likely made up.
3. **Treat empty results as a signal.** An empty result often means the user lacks access, not that the information doesn't exist. Report it plainly instead of padding with weak results.
4. **Prefer recent sources.** Glean ranks by relevance. For time-sensitive questions, add a date filter or sort by recency. Say so when sources are stale or disagree.
5. **Vet before presenting.** Apply the criteria in [reference/vetting.md](reference/vetting.md): relevance, freshness, and authority. Three vetted results beat ten unfiltered ones.
6. **Use as few calls as the question needs.** Run independent calls in parallel. Stop when the question is answered.
7. **Retry a search at most twice.** Change the keywords or filters each time. If you still have nothing, say what you tried.

## Cross-cutting reference

- **[synthesis.md](reference/synthesis.md)**: patterns for combining Glean tools when one tool doesn't answer the question.
- **[vetting.md](reference/vetting.md)**: how to judge source quality, freshness, and authority, and when to tell the user how confident you are.

## Glean platform agents

If the user's Glean instance has platform agents enabled, they may appear as more tools in the tool list. The set is specific to the organization and can change at any time. See [agents-as-tools.md](reference/agents-as-tools.md) for how to recognize, inspect, and call them.
