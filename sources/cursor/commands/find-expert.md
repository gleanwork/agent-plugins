---
name: find-expert
description: Find subject matter experts for a topic based on actual activity and contributions, not just org chart position
---

# Find Expert

Find people who *actually* know about a topic — based on real contributions and activity, not just org chart position.

The topic or area of expertise comes from the user's message.

## Core Principles

- **Activity over title**: Someone actively contributing beats someone nominally responsible
- **Multiple signals**: Code + docs + discussions = true expertise
- **Be skeptical**: Just mentioning a topic doesn't make someone an expert
- **Quality over quantity**: 3 vetted experts beats 10 names

## Phase 1: Understand What's Needed

If the topic is vague, clarify:
- What type of expertise? (Answer questions, review code, make decisions)
- Specific system or general technology?

## Phase 2: Gather Expertise Signals

Start with a synthesized view:
```
chat "Who are the experts on [topic] at our company? Consider code contributions, documentation authorship, and meeting participation."
```

Then gather direct signals:
```
employee_search "[topic]"
code_search "[topic] contributors"
search "[topic] RFC OR design doc"
```

Cross-reference to find people appearing in multiple sources.

## Phase 3: Vet Each Candidate

| Test | ✅ Include | ⚠️ Caution | ❌ Reject |
|------|-----------|-----------|---------|
| **Evidence** | Authored RFC, significant code, documented expert | Single significant signal | Single Slack mention, meeting attendee |
| **Recency** | Active in past 6 months | Active 6-12 months ago | No activity in 12+ months |
| **Role** | Still on relevant team | Changed teams, retains knowledge | Left company |
| **Signals** | 3+ independent signals | 2 signals | Single signal only |

## Phase 4: Generate Expertise Report

```markdown
# Expert Finder: [Topic]

## Vetting Summary
| Candidates Found | Passed Vetting | Rejected |

## Top Experts

### 1. [Name] — [Current Role]
**Confidence**: High
**Expertise Signals:**
- [Signal 1 with evidence]
- [Signal 2 with evidence]
**Last active:** [When] | **Contact:** [email/Slack]

## Also Consider

### Historical Experts
- **[Name]**: [Past role] — useful for historical context only

### By Official Role
- **[Team]**: Officially owns this area

## Rejected Candidates
| Name | Reason |

## How to Engage
- **Quick questions**: [Person] via Slack
- **Deep dives**: Schedule time with [Person]
- **Official decisions**: Loop in [Person] — has sign-off authority
```

## If No Experts Pass Vetting

```markdown
## No High-Confidence Experts Found

**This could mean:**
- New area without established experts
- Expertise exists but isn't well-documented
- Different terminology used internally

**Suggested next steps:**
1. Try broader term
2. Ask in [related Slack channel]
```
