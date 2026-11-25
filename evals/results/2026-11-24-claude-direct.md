# Claude skill eval, 2026-11-24

- **Baseline:** `glean` 3.6.2, from https://github.com/gleanwork/claude-plugins@2b1d443.
- **Candidate:** `glean` 3.6.2, a work-in-progress build that is not published. It is `main` at 4b2488e with the local relay and its hooks removed, the MCP server set to the user's Glean URL, and four skills changed. `glean_run` is rewritten. `using-glean`, `project-handoff` and `skill-creation-guide` now say where to connect Glean in Claude Code. Its other skills are the same as the baseline's.
- **Host:** Claude Code 2.1.319, model `claude-sonnet-5-5`.
- **Harness:** MCP Server Tester 2.0.0-rc.4, 5 trials for each case.

See [the README](../README.md) for the method, the server shapes and the limits.

## Summary

A case passes when every one of its trials passes. Calls, cost and time are means for one trial.
"Names `setup`" counts the answers that send the user to the relay's `setup` tool on a server that has no such tool.

| Shape | Build | Cases passed | Trials passed | MCP calls | Names `setup` | Cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `relay` | baseline | 6/7 | 34/35 | 2.2 | n/a | $0.054 | 13.5 s |
| `relay` | candidate | 7/7 | 35/35 | 1.8 | n/a | $0.051 | 12.1 s |
| `relay-first-run` | baseline | 2/2 | 10/10 | 1.5 | n/a | $0.051 | 7.5 s |
| `relay-first-run` | candidate | 2/2 | 10/10 | 2.0 | n/a | $0.046 | 7.3 s |
| `direct` | baseline | 7/7 | 35/35 | 2.3 | 8/35 | $0.050 | 11.1 s |
| `direct` | candidate | 7/7 | 35/35 | 2.3 | 0/35 | $0.047 | 10.2 s |
| `no-discovery` | baseline | 1/2 | 5/10 | 1.9 | 10/10 | $0.054 | 9.2 s |
| `no-discovery` | candidate | 2/2 | 10/10 | 1.5 | 0/10 | $0.045 | 7.2 s |
| `no-glean` | baseline | 0/6 | 5/30 | 0.0 | 28/30 | $0.056 | 20.3 s |
| `no-glean` | candidate | 6/6 | 30/30 | 0.0 | 0/30 | $0.036 | 9.1 s |

## Findings

1. **With the relay, the two builds do the same work.** The candidate passes
   all 45 trials on `relay` and `relay-first-run`. The baseline passes 44. In
   one trial it gave the right answer from `search`, and the case requires
   `run_tool`. In the two cases where the user runs `glean_run` and a skill
   matches, the candidate makes one call fewer (2.0 against 3.0), because it
   does not call `setup` first. In the first-run case where the user runs
   `glean_run`, it makes one call more (2.0 against 1.0), because it tries
   discovery before `setup`.
2. **On a direct server, both builds finish every task.** Both pass 35 of 35
   trials on `direct`. The baseline's `glean_run` names the missing `setup`
   tool in 8 of its 15 answers. The candidate's names it in none.
3. **Without skill discovery, only the candidate says who can fix it.** For a
   task that no tool on the server can do, the candidate's answer names a
   Glean admin in 5 of 5 trials. The baseline's names one in none, and all 5
   send the user to `setup`.
4. **With no Glean server, only the candidate says where to connect it.** The
   candidate names `/plugin` or `/mcp` in 30 of 30 answers, and names `setup`
   in none. The baseline names `/plugin` or `/mcp` in 5 of 30, and `setup` in
   28. The baseline also takes longer (20.3 s against 9.1 s). In 9 of its 10
   handoff trials it starts a research subagent that has no Glean tools. The
   candidate does that in 1 of 10.

The [run of 2026-11-23](2026-11-23-claude-direct.md) found the gap that
finding 4 closes. Its candidate changed `glean_run` only. When the user asked
in plain words, Claude Code loaded `using-glean`, and all 5 of the candidate's
answers named `setup`. This run's candidate changes that skill and the two
others that held the same sentence, and this run adds four cases for them.

Read these with the limits in mind. The server is a stub, and there is one
model. Five trials for each case cannot tell a build that always passes from
one that passes most of the time: two baseline cases that passed 5 of 5 on
2026-11-23 pass 4 of 5 here, and the baseline did not change between the runs.

## `relay`

Run `20261124T164936Z-8934ee`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls |
| --- | --- | --- | --- | --- |
| `jira-status-explicit` | 4/5 | 5/5 | 3.0 | 2.0 |
| `jira-assignee-natural` | 5/5 | 5/5 | 1.8 | 1.8 |
| `calendar-explicit` | 5/5 | 5/5 | 3.0 | 2.0 |
| `calendar-natural` | 5/5 | 5/5 | 2.0 | 2.0 |
| `no-match-explicit` | 5/5 | 5/5 | 2.4 | 2.0 |
| `search-skill-explicit` | 5/5 | 5/5 | 1.0 | 1.0 |
| `company-question-natural` | 5/5 | 5/5 | 2.0 | 1.6 |

## `relay-first-run`

Run `20261124T164936Z-dad355`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls |
| --- | --- | --- | --- | --- |
| `fr-jira-status-explicit` | 5/5 | 5/5 | 1.0 | 2.0 |
| `fr-jira-status-natural` | 5/5 | 5/5 | 2.0 | 2.0 |

## `direct`

Run `20261124T164936Z-b099c1`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls | Baseline names `setup` | Candidate names `setup` |
| --- | --- | --- | --- | --- | --- | --- |
| `jira-status-explicit` | 5/5 | 5/5 | 3.0 | 3.0 | 2/5 | 0/5 |
| `jira-assignee-natural` | 5/5 | 5/5 | 2.8 | 2.6 | 0/5 | 0/5 |
| `calendar-explicit` | 5/5 | 5/5 | 3.0 | 3.0 | 2/5 | 0/5 |
| `calendar-natural` | 5/5 | 5/5 | 3.0 | 3.0 | 0/5 | 0/5 |
| `no-match-explicit` | 5/5 | 5/5 | 1.6 | 2.0 | 4/5 | 0/5 |
| `search-skill-explicit` | 5/5 | 5/5 | 1.0 | 1.0 | 0/5 | 0/5 |
| `company-question-natural` | 5/5 | 5/5 | 1.8 | 1.8 | 0/5 | 0/5 |

## `no-discovery`

Run `20261124T164936Z-204350`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls | Baseline names `setup` | Candidate names `setup` |
| --- | --- | --- | --- | --- | --- | --- |
| `nd-jira-status-explicit` | 5/5 | 5/5 | 1.2 | 1.0 | 5/5 | 0/5 |
| `nd-calendar-explicit` | 0/5 | 5/5 | 2.6 | 2.0 | 5/5 | 0/5 |

## `no-glean`

Run `20261124T164936Z-dc8b94`.

| Case | Baseline passed | Candidate passed | Baseline calls | Candidate calls | Baseline names `setup` | Candidate names `setup` |
| --- | --- | --- | --- | --- | --- | --- |
| `ng-jira-status-explicit` | 4/5 | 5/5 | 0.0 | 0.0 | 5/5 | 0/5 |
| `ng-jira-status-natural` | 0/5 | 5/5 | 0.0 | 0.0 | 5/5 | 0/5 |
| `ng-handoff-explicit` | 0/5 | 5/5 | 0.0 | 0.0 | 5/5 | 0/5 |
| `ng-handoff-natural` | 1/5 | 5/5 | 0.0 | 0.0 | 4/5 | 0/5 |
| `ng-automation-explicit` | 0/5 | 5/5 | 0.0 | 0.0 | 5/5 | 0/5 |
| `ng-automation-natural` | 0/5 | 5/5 | 0.0 | 0.0 | 4/5 | 0/5 |
