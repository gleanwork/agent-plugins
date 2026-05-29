---
name: stakeholders
description: Identify stakeholders who need to approve, consult on, or be informed about a change or project.
  Use when planning a change that affects other teams or systems and needing to know who to involve, consult, or notify.
---

# Stakeholder Discovery

Identify the right people to involve in a change, decision, or project.

## Core Principles

- **Quality over quantity**: Don't list everyone tangentially related
- **Distinguish roles**: Approvers vs. consultants vs. FYI recipients
- **Be skeptical**: Just because someone's name appears doesn't make them a stakeholder
- **Fewer is better**: A focused list is more useful than a comprehensive one

## Phase 1: Understand the Change

Clarify what's being changed and why:
- What type of change? (Technical, process, or both)
- What's the scope? (Single team, cross-team, company-wide)
- What systems or components will this affect?

## Phase 2: Find Stakeholders

Identify technical owners, decision makers, and affected parties:

1. Start with Glean chat for a synthesized stakeholder view:
   ```
   chat "Who are the stakeholders for [change/system]? Include code owners, decision makers, and teams that depend on this."
   ```

2. Gather specific details with direct searches:
   ```
   code_search "[affected system] contributors"
   search "[affected system] RFC OR architecture doc"
   employee_search "[affected system] team lead OR manager"
   ```

3. Search for downstream dependencies:
   ```
   search "[affected system] integration OR dependency OR consumer"
   ```

## Phase 3: Vet Each Stakeholder

For each person found, evaluate:

| Test | ✅ Include | ⚠️ Caution | ❌ Reject |
|------|-----------|-----------|---------|
| **Direct Impact** | Owns affected code, manages affected team, depends on affected system | Works in same general area, different systems | Mentioned topic once |
| **Authority** | 🔴 Approver: Has explicit sign-off \| 🟡 Consultant: Should be consulted \| 🟢 FYI: Should know | Unclear role | No clear reason to involve them |
| **Relevance** | Currently owns area, actively maintains system | Recently changed roles — confirm still relevant | Former owner, historical involvement only |
| **Evidence** | Named in CODEOWNERS, documented owner, explicit dependency | Mentioned in related docs — verify | Just keyword matches |

**Ask yourself**: "If I didn't include this person, what would go wrong?"
- If the answer is "nothing" or "probably fine" → reject

## Phase 4: Generate Stakeholder Map

```markdown
# Stakeholder Map: [Change/Project]

## Summary
[Brief description of the change and why stakeholders matter]

## Vetting Summary
| Candidates Found | Included | Rejected |
|------------------|----------|----------|
| [X] | [Y] | [Z] |

## Decision Makers (Must Approve)
| Name | Role | Why They Approve | Evidence |
|------|------|------------------|----------|
| [Name] | [Role] | [Reason] | [Source] |

## Technical Owners (Must Consult)
| Name | Ownership | Last Active | Evidence |
|------|-----------|-------------|----------|
| [Name] | [What they own] | [When] | [CODEOWNERS/commits] |

## Downstream Teams (Must Inform)
| Team/Person | Impact | Evidence |
|-------------|--------|----------|
| [Team] | [How affected] | [Integration/dependency doc] |

## Rejected Candidates
| Name | Reason |
|------|--------|
| [Name] | Tangential involvement — no direct impact |
| [Name] | Former owner, no longer relevant |

## Recommended Engagement Order

### Phase 1: Initial Consultation
1. Talk to [key person] about [specific question]
2. Review with [technical owner]

### Phase 2: Approval
3. Get sign-off from [decision maker]

### Phase 3: Communicate
4. Inform [downstream teams]
```

## If Few or No Stakeholders Found

```markdown
# Stakeholder Map: [Change/Project]

## Minimal Stakeholders Identified

This change appears to have limited stakeholder impact.

**Why the list is small:**
- Change is contained to [specific area]
- No downstream dependencies found

**Verify this is correct:**
- Check with [team lead] that no dependencies were missed
- Confirm [system] doesn't have undocumented consumers
```

## Troubleshooting

### Glean MCP Not Connected
If you see errors about missing `mcp__glean` tools, check `~/.cursor/mcp.json` for a Glean server entry and use the mcp-setup skill to configure one.
