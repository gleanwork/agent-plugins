---
name: codebase-context
description: Get architectural context about an internal system from code repositories and documentation
---

# Codebase Context

Gather comprehensive architectural context about an internal system by searching code and documentation across the organization.

The system or component to research comes from the user's message.

## Core Principles

- **Breadth before depth**: Find all relevant pieces before diving deep
- **Docs + code**: Both tell important parts of the story
- **Be skeptical**: Not every search result is relevant context
- **Freshness matters**: Stale docs can mislead

## Process

### Phase 1: Find the Code

Search for the system's codebase across all repositories:

```
code_search "[system] main OR core updated:past_month"
code_search "[system] service handler"
```

Look for main entry points, API definitions, and key data structures.

### Phase 2: Find the Documentation

Search for architecture and design docs:

```
search "[system] architecture OR design doc"
search "[system] RFC OR proposal"
search "[system] runbook OR playbook"
```

### Phase 3: Identify Key Contributors

```
code_search "[system] owner:* updated:past_month"
```

Cross-reference with `employee_search` for contact info.

### Phase 4: Vet All Content

For each piece of content evaluate relevance, currency, and authority:
- ✅ CURRENT: Updated in past 6 months, matches code
- ⚠️ AGING: 6-12 months — note with caution
- ❌ STALE: 12+ months — likely outdated

### Phase 5: Generate Vetted Context Report

```markdown
# Codebase Context: [System Name]

## Freshness Check
| Component | Last Updated | Status |
|-----------|--------------|--------|
| Main repo | [date] | Active / Slowing / Stale |

## Overview
[1-2 paragraph summary from current docs]

## Key Repositories
| Repository | Purpose | Last Active | Status |
|------------|---------|-------------|--------|

## Architecture Highlights
- **API Layer**: [description] (source: [doc], updated [date])
- **Key Dependencies**: [list]

## Documentation (Vetted)
| Doc | Type | Updated | Summary |
|-----|------|---------|---------|

## Key Contributors
| Name | Role | Last Active | Contact |
|------|------|-------------|---------|

## Related Systems
- **Upstream**: [systems that call this one]
- **Downstream**: [systems this one calls]

## Warnings
[Any concerns about the system's state]
```

## If Limited Context Found

```markdown
## Limited Context Available

Found limited authoritative information about this system.

**Gaps:** [missing docs, stale repos, etc.]

**Suggested next steps:**
1. Check with [suggested team/person]
2. Explore the code directly: [suggested entry points]
```
