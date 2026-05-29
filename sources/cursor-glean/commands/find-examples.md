---
name: find-examples
description: Find usage examples of an API, library, or code pattern across internal repositories
---

# Find Examples

Search across all repositories to find usage examples of an API, library, or pattern.

The API or pattern to search for comes from the user's message.

## Core Principles

- **Prioritize recency**: Recent examples follow current best practices
- **Show context**: Code snippets without context aren't helpful
- **Be skeptical**: Not every match is a good example
- **Quality over quantity**: 3 excellent examples beats 10 mediocre ones

## Process

### Phase 1: Search for Usage

```
code_search "[topic] import OR require"
code_search "[topic] usage example"
code_search "[topic] implementation"
```

### Phase 2: Find Different Approaches

```
code_search "[topic] config OR configuration"
code_search "[topic] test OR spec"
```

### Phase 3: Find Documentation

```
search "[topic] how to use OR getting started"
search "[topic] best practices OR guidelines"
```

### Phase 4: Vet Each Example

| Test | ✅ Include | ⚠️ Caution | ❌ Reject |
|------|-----------|-----------|---------|
| **Quality** | Clean, well-structured, tested | Works but has issues | Hacky, deprecated, anti-pattern |
| **Recency** | <6 months | 6-12 months | 12+ months with no activity |
| **Context** | Production code, maintained | Experiments | Abandoned PRs, boilerplate |

**Anti-pattern signals — reject or warn:** large error-swallowing catch blocks, commented-out code, TODOs, `/deprecated/` paths, skipped tests.

### Phase 5: Present Vetted Examples

```markdown
# Usage Examples: [API/Pattern]

## Summary
| Examples Found | High Quality | Cautionary | Rejected |
|----------------|--------------|------------|----------|

## Recommended Examples

### Example 1: [Repo/Team Name] ⭐
**File:** [path] ([link]) | **Last Updated**: [date]
**Why this is good:** [specific patterns]

## Examples With Caveats
### [Repo] — Use With Caution
**Caveat:** [What to watch out for]

## Shared Libraries
- **[library name]** ([link]) — Use this instead of rolling your own
```

## If No Good Examples Found

```markdown
## No High-Quality Examples Found

**Suggested next steps:**
1. Check the official documentation directly
2. Ask in [relevant Slack channel]
```
