---
name: code-owners
description: Identify who owns or maintains a specific code area, service, or component
---

# Code Owners

Identify who owns, maintains, or has expertise in a specific code area.

The component or system to research comes from the user's message.

## Core Principles

- **Multi-signal identification**: Code + docs + org structure = complete picture
- **Recency matters**: Active maintainers are more useful than historical authors
- **Be skeptical**: Just having commits doesn't make someone the right contact
- **Quality over quantity**: 2-3 right people beats 10 tangential names

## Process

### Phase 1: Find Recent Contributors

```
code_search "[component] owner:* updated:past_month"
code_search "[component] from:* updated:past_3_months"
```

### Phase 2: Find Historical Authors

```
code_search "[component] owner:* after:2023-01-01"
```

### Phase 3: Find Documentation Authors

```
search "[component] design doc OR architecture owner:*"
search "[component] RFC owner:*"
```

### Phase 4: Cross-Reference with Org Info

```
employee_search "[contributor names]"
```

### Phase 5: Vet Each Candidate

| Test | ✅ Active Owner | ⚠️ Consider | ❌ Reject |
|------|---------------|------------|---------|
| **Ownership** | Multiple commits in past 3 months | Occasional activity | Single commit, tangential |
| **Relevance** | Same team, same area | Changed teams but retains context | Left company, different area |
| **Knowledge** | Wrote design docs, significant PRs | Regular contributor | Minor commits, typo fixes |

### Phase 6: Present Vetted Ownership Map

```markdown
# Code Ownership: [Component]

## Primary Contacts (Recommended)

### 1. [Name] — [Title]
- **Why**: [evidence]
- **Good for**: [type of questions]
- **Contact**: [email]

## Secondary Contacts
| Name | Role | Why Secondary | Contact |

## Historical Contributors
| Name | Contribution | Current Role | Last Active |

## Team Ownership
- **Team**: [team name]
- **Slack channel**: [channel]

## Rejected Candidates
| Name | Reason |
```

## If No Clear Owners Found

```markdown
## Ownership Unclear

**Suggested next steps:**
1. Check the repository's CODEOWNERS file directly
2. Look at recent PR reviewers
3. Ask in [relevant Slack channel]
```
