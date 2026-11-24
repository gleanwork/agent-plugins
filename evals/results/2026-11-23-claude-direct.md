# Claude skill eval, 2026-11-23

- **Baseline:** `glean` 3.6.2, from https://github.com/gleanwork/claude-plugins@2b1d443.
- **Candidate:** `glean` 3.6.2, a work-in-progress build that is not published. It is `main` at 4b2488e with the local relay and its hooks removed, the MCP server set to the user's Glean URL, and `glean_run` rewritten. Its other skills are the same as the baseline's.
- **Host:** Claude Code 2.1.319, model `claude-sonnet-5-5`.
- **Harness:** MCP Server Tester 2.0.0-rc.4, 5 trials for each case.

See [the README](../README.md) for the method, the server shapes and the limits.

## Summary

A case passes when every one of its trials passes. Calls, cost and time are means for one trial.
"Names `setup`" counts the answers that send the user to the relay's `setup` tool on a server that has no such tool.

| Shape | Build | Cases passed | Trials passed | MCP calls | Names `setup` | Cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `relay` | baseline | 7/7 | 35/35 | 2.1 | n/a | $0.055 | 13.8 s |
| `relay` | candidate | 7/7 | 35/35 | 1.9 | n/a | $0.050 | 10.5 s |
| `relay-first-run` | baseline | 2/2 | 10/10 | 1.5 | n/a | $0.051 | 7.4 s |
| `relay-first-run` | candidate | 2/2 | 10/10 | 2.0 | n/a | $0.046 | 7.2 s |
| `direct` | baseline | 7/7 | 35/35 | 2.5 | 10/35 | $0.050 | 10.8 s |
| `direct` | candidate | 7/7 | 35/35 | 2.5 | 0/35 | $0.048 | 9.2 s |
| `no-discovery` | baseline | 1/2 | 5/10 | 1.6 | 10/10 | $0.054 | 9.6 s |
| `no-discovery` | candidate | 2/2 | 10/10 | 1.5 | 0/10 | $0.045 | 7.1 s |
| `no-glean` | baseline | 1/2 | 6/10 | 0.1 | 10/10 | $0.045 | 7.0 s |
| `no-glean` | candidate | 1/2 | 7/10 | 0.0 | 5/10 | $0.036 | 6.3 s |

## Findings

1. **With the relay, the two builds do the same work.** Both pass every trial
   on `relay` and `relay-first-run`. In the two cases where the user runs
   `glean_run` and a skill matches, the candidate makes one call fewer (2.0
   against 3.0), because it does not call `setup` first. In the first-run case
   where the user runs `glean_run`, it makes one call more (2.0 against 1.0),
   because it tries discovery before `setup`.
2. **On a direct server, both builds finish every task.** Both pass 35 of 35
   trials on `direct`. The baseline's `glean_run` names the missing `setup`
   tool in 10 of its 15 answers. The candidate's names it in none.
3. **Without skill discovery, only the candidate says who can fix it.** For a
   task that no tool on the server can do, the candidate's answer names a
   Glean admin in 5 of 5 trials. The baseline's names one in none, and all 5
   send the user to `setup`.
4. **With no Glean server, a skill that did not change gives advice the user
   cannot follow.** When the user runs `glean_run`, both builds name `/plugin`
   or `/mcp` in 5 of 5 trials. When the user asks in plain words, Claude Code
   loads `using-glean`, not `glean_run`. That skill tells the user to say
   "Set up Glean for me", which needs the relay's `setup` tool. All 10 answers
   repeat it, and only 3 of 10 name `/plugin` or `/mcp`. The candidate has to
   change `using-glean` too. `project-handoff` and `skill-creation-guide` hold
   the same sentence, and no case covers them yet. The
   [run of 2026-11-24](2026-11-24-claude-direct.md) tests a candidate that
   changes all three.

Read these with the limits in mind. The server is a stub, there is one model,
and 5 trials for each case cannot tell a build that always passes from one
that passes most of the time.

## `relay`

Run `20261123T214222Z-c8e116`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls |
| --- | --- | --- | --- | --- |
| `jira-status-explicit` | 5/5 | 5/5 | 3.0 | 2.0 |
| `jira-assignee-natural` | 5/5 | 5/5 | 1.4 | 1.8 |
| `calendar-explicit` | 5/5 | 5/5 | 3.0 | 2.0 |
| `calendar-natural` | 5/5 | 5/5 | 2.0 | 2.4 |
| `no-match-explicit` | 5/5 | 5/5 | 2.6 | 2.0 |
| `search-skill-explicit` | 5/5 | 5/5 | 1.0 | 1.0 |
| `company-question-natural` | 5/5 | 5/5 | 2.0 | 1.8 |

## `relay-first-run`

Run `20261123T214222Z-7cc8af`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls |
| --- | --- | --- | --- | --- |
| `fr-jira-status-explicit` | 5/5 | 5/5 | 1.0 | 2.0 |
| `fr-jira-status-natural` | 5/5 | 5/5 | 2.0 | 2.0 |

## `direct`

Run `20261123T214222Z-c65f83`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls | Baseline names `setup` | Candidate names `setup` |
| --- | --- | --- | --- | --- | --- | --- |
| `jira-status-explicit` | 5/5 | 5/5 | 3.0 | 3.0 | 1/5 | 0/5 |
| `jira-assignee-natural` | 5/5 | 5/5 | 2.8 | 3.0 | 0/5 | 0/5 |
| `calendar-explicit` | 5/5 | 5/5 | 3.0 | 3.0 | 4/5 | 0/5 |
| `calendar-natural` | 5/5 | 5/5 | 3.0 | 3.0 | 0/5 | 0/5 |
| `no-match-explicit` | 5/5 | 5/5 | 2.4 | 2.2 | 5/5 | 0/5 |
| `search-skill-explicit` | 5/5 | 5/5 | 1.0 | 1.0 | 0/5 | 0/5 |
| `company-question-natural` | 5/5 | 5/5 | 2.0 | 2.0 | 0/5 | 0/5 |

## `no-discovery`

Run `20261123T214222Z-2418b4`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls | Baseline names `setup` | Candidate names `setup` |
| --- | --- | --- | --- | --- | --- | --- |
| `nd-jira-status-explicit` | 5/5 | 5/5 | 1.0 | 1.0 | 5/5 | 0/5 |
| `nd-calendar-explicit` | 0/5 | 5/5 | 2.2 | 2.0 | 5/5 | 0/5 |

## `no-glean`

Run `20261123T214222Z-35d1be`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls | Baseline names `setup` | Candidate names `setup` |
| --- | --- | --- | --- | --- | --- | --- |
| `ng-jira-status-explicit` | 5/5 | 5/5 | 0.2 | 0.0 | 5/5 | 0/5 |
| `ng-jira-status-natural` | 1/5 | 2/5 | 0.0 | 0.0 | 5/5 | 5/5 |
