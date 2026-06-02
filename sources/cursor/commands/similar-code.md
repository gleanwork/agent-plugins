---
name: similar-code
description: Find similar implementations or prior art for a code pattern across internal repositories
---

# Similar Code

Search for similar implementations across the organization to find prior art, alternative approaches, or shared solutions.

The pattern or feature to search for comes from the user's message.

## Core Principles

- **Find the blessed path**: Look for official/platform solutions first
- **Compare approaches**: Different solutions have different tradeoffs
- **Be skeptical**: Not every implementation is worth following
- **Quality over quantity**: 3 vetted implementations beats 10 random matches

## Process

### Phase 1: Search for Direct Implementations

```
code_search "[topic] implementation"
code_search "[topic] handler OR service"
code_search "[topic] util OR helper"
```

### Phase 2: Search for Alternative Terms

The same concept might be named differently (e.g., "rate limiting" → "throttling", "quota", "backpressure"):

```
code_search "[synonym] implementation"
```

### Phase 3: Find Shared Libraries

```
code_search "[topic] package OR library"
search "[topic] shared library OR common"
```

### Phase 4: Find Related Discussions

```
search "[topic] design doc OR RFC"
search "[topic] best practices OR guidelines"
```

### Phase 5: Vet Each Implementation

| Test | ✅ Recommended | ⚠️ Acceptable | ❌ Reject |
|------|--------------|-------------|---------|
| **Quality** | Clean, tested, best practices | Works but has caveats | Hacky, untested, deprecated |
| **Maintenance** | Commits in past 3 months | 3-12 months since last commit | No activity in 12+ months |
| **Adoption** | Deployed, actively used | Small usage | Experiments, abandoned PRs |

**Anti-pattern signals:** `/deprecated/`, `/old/`, `/legacy/` paths; large commented sections; TODOs; no tests.

### Phase 6: Present Vetted Comparison

```markdown
# Similar Implementations: [Pattern]

## Recommended Solution
- **Library**: [name] ([link]) — ⭐ Use this instead of building your own

## Vetted Implementations

### ⭐ [Repo Name] — RECOMMENDED
**Location:** [path] | **Last Updated**: [date] | **Maintainer**: [person/team]
**Why recommended:** [specific patterns]

### [Repo Name] — ACCEPTABLE
**Pros:** [advantage] | **Cons:** [limitation]

## Rejected Implementations
| Repo | Reason |

## Recommendations
1. **Best option**: [recommendation and reason]
2. **Avoid**: [anti-pattern]
```
