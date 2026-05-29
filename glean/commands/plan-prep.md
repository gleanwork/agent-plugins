---
name: plan-prep
description: Research enterprise context before planning — gathers design docs, similar implementations, stakeholders, and related systems
---

# Planning Preparation

Research enterprise context before entering plan mode by gathering design docs, similar implementations, stakeholders, and related systems.

The task or feature being planned comes from the user's message.

## Why This Matters

Better planning comes from enterprise context:
- **Design Decisions**: Understand what was tried before and why
- **Similar Implementations**: Find proven patterns to build on
- **Stakeholders**: Identify who needs to be involved
- **Related Systems**: Understand dependencies and integration points

## Process

### Phase 1: Search for Design & Architecture

```
search "[task] architecture OR design doc"
search "[task] RFC OR proposal"
search "[task] pattern OR best practice"
```

### Phase 2: Find Code Implementations & Patterns

```
code_search "[task] implementation OR pattern"
code_search "[related systems] updated:past_month"
```

### Phase 3: Identify Stakeholders & Owners

```
code_search "[relevant systems] owner:* updated:past_month"
employee_search "[systems and names identified]"
```

### Phase 4: Find Related Systems

```
code_search "[main system] calls OR depends OR imports"
```

### Phase 5: Vet All Research

For each finding evaluate:
- **Freshness**: ✅ <6mo | ⚠️ 6-12mo | ❌ 12+mo
- **Relevance**: ✅ Directly applies | ⚠️ Similar context | ❌ Keyword match only
- **Authority**: ✅ Approved RFC | ⚠️ Team wiki | ❌ Abandoned/rejected

### Phase 6: Generate Planning Context Report

```markdown
# Planning Context: [Task]

## Design & Architecture
### Relevant Design Documents
| Document | Type | Key Takeaway | Updated |

### Previous Decisions
- **[Topic]**: [Why was decision X made? Lessons learned?]

## Implementations & Patterns
### Recommended Examples
| Location | What It Does | Why It's Good | Status |

## Stakeholders & Ownership
### Active Owners
| Name | Role | Involvement | Contact |

### Teams & Channels
- **Primary Team**: [team name]
- **Slack Channel**: [#channel]

## Related Systems
- **Upstream**: [systems that depend on this]
- **Downstream**: [systems this depends on]

## Key Insights
- [Important constraint or opportunity]
- [Proven pattern or anti-pattern]
- [Stakeholders who must be involved]

## Sources
| Document | Type | Relevance | Currency |
```

## If Limited Context Found

```markdown
## Limited Research Available

**Gaps:** No recent design docs, limited prior art

**Suggested next steps:**
1. Check with [suggested team] about prior attempts
2. Enter plan mode to design initial approach, then validate with stakeholders
```
