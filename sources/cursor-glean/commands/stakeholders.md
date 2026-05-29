---
name: stakeholders
description: Identify stakeholders who should be consulted or informed about a change, project, or decision
---

# Stakeholder Discovery

Identify the right people to involve in a change, decision, or project.

The change or project comes from the user's message.

## Core Principles

- **Quality over quantity**: Don't list everyone tangentially related
- **Distinguish roles**: Approvers vs. consultants vs. FYI recipients
- **Be skeptical**: Appearing in search results doesn't make someone a stakeholder
- **Fewer is better**: A focused list is more useful than a comprehensive one

## Phase 1: Understand the Change

If the change is vague, clarify:
- Type of change? (Technical, process, or both)
- Scope? (Single team, cross-team, company-wide)
- Which systems or components are affected?

## Phase 2: Find Stakeholders

Start with a synthesized view:
```
chat "Who are the stakeholders for [change/system]? Include code owners, decision makers, and teams that depend on this."
```

Then gather specific details:
```
code_search "[affected system] contributors"
search "[affected system] RFC OR architecture doc"
employee_search "[affected system] team lead OR manager"
search "[affected system] integration OR dependency OR consumer"
```

## Phase 3: Vet Each Stakeholder

| Test | ✅ Include | ⚠️ Caution | ❌ Reject |
|------|-----------|-----------|---------|
| **Direct Impact** | Owns affected code, depends on affected system | Same general area, different systems | Mentioned topic once |
| **Authority** | 🔴 Must approve \| 🟡 Must consult \| 🟢 Must inform | Unclear role | No clear reason to involve |
| **Relevance** | Currently owns area | Recently changed roles — verify | Former owner, historical only |

**Ask yourself**: "If I didn't include this person, what would go wrong?" If the answer is "probably nothing" → reject.

## Phase 4: Generate Stakeholder Map

```markdown
# Stakeholder Map: [Change/Project]

## Vetting Summary
| Candidates Found | Included | Rejected |

## Decision Makers (Must Approve)
| Name | Role | Why They Approve | Evidence |

## Technical Owners (Must Consult)
| Name | Ownership | Last Active | Evidence |

## Downstream Teams (Must Inform)
| Team/Person | Impact | Evidence |

## Rejected Candidates
| Name | Reason |

## Recommended Engagement Order

### Phase 1: Initial Consultation
1. Talk to [key person] about [specific question]

### Phase 2: Approval
2. Get sign-off from [decision maker]

### Phase 3: Communicate
3. Inform [downstream teams]
```
