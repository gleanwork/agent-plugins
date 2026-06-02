---
name: search
description: Search Glean enterprise knowledge and return vetted, quality-filtered results
---

# Glean Search

Search across Glean enterprise knowledge for the topic provided in your message.

## Core Principles

- **Relevance over completeness**: Show the best results, not all results
- **Be skeptical**: Not every keyword match is relevant
- **Context matters**: Include enough info to assess relevance

## Search Process

### 1. Execute Search

Use the Glean search tool with the query from the user's message.

### 2. Assess Results

For each result, evaluate:

**Relevance**:
- ✅ RELEVANT: Actually about the query topic
- ❌ SKIP: Keyword coincidence, different context

**Currency**:
- ✅ CURRENT: Recent update
- ⚠️ OLD: May be outdated

Only show results that pass the relevance check. If old, note it.

### 3. Present Vetted Results

For each included result:
- **Title** (as a clickable link if URL available)
- **Source** (app/datasource)
- **Last updated** (with freshness indicator: ✅ <6mo, ⚠️ 6-12mo, ❌ >12mo)
- **Snippet** (relevant excerpt)
- **Relevance note** (why this matches)

### 4. Note Quality

After results, include:
- How many results were found vs. shown
- Any concerns about result quality
- Suggestions if results seem limited

### 5. Offer Follow-up Actions

After showing results, offer next steps:
- Read a document in full
- Refine search with filters
- Search a related topic

## Example Output

```markdown
## Search Results: [query]

Found [X] results, showing top [Y] most relevant:

### 1. [Title] ✅
**Source**: Confluence | **Updated**: 2 weeks ago ✅
> [Relevant snippet...]

**Why relevant**: [Brief note on why this matches]

---

**Quality note**: [X] results filtered out (keyword matches in different context)
```

## Troubleshooting

### Glean MCP Not Connected
If you see errors about missing `mcp__glean` tools:
- Run `/mcp-status` to check connection
- Run `/mcp-setup` to configure
