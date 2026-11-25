# Skill evals

These evals measure how a change to the Glean plugin's skills changes what the
model does. They run the real host with the plugin installed, and compare two
builds of the plugin on the same cases.

They use [MCP Server Tester](https://github.com/gleanwork/mcp-server-tester)
(MST), which runs the host headless, records each skill load and tool call,
and grades each trial.

Run them before you change a skill, and put the summary in the pull request.

## What is compared

Each eval has two variants:

- **baseline**: the published plugin. By default this is the commit of
  `gleanwork/claude-plugins` that `claude/setup.mjs` pins.
- **candidate**: the build you give `setup.mjs`.

Both run in Claude Code with the `glean` plugin installed from a marketplace,
as a user installs it. The only difference between the variants is the plugin.

MST gives Claude Code the eval's MCP servers and no others, so the plugin's own
MCP server entry is not used. The server comes from the eval config. That lets
one eval hold the server constant and change only the skills.

## Server shapes

A skill has to work with whatever tools the server offers. Each eval config
runs both variants against one shape:

| Shape | Tools the model sees | Stands for |
| --- | --- | --- |
| `relay` | `find_skills_and_tools`, `run_tool`, `setup`, `search`, `read_document` | The plugin's local relay, from the baseline build, in front of Glean. |
| `relay-first-run` | `find_skills_and_tools`, `run_tool`, `setup` | The same relay straight after install, with no server URL and no token. |
| `direct` | `find_skills_and_tools`, `read_skill_files`, `run_tool`, `search`, `read_document` | Claude Code connected to a Glean server that offers skill discovery. |
| `proxy` | `find_skills_and_tools`, `run_tool`, `get_tool_approval`, `set_tool_approval`, `search`, `read_document` | Claude Code connected to the plugin's own endpoint with no relay. The model can see the tool that saves Always Allow. |
| `no-discovery` | `search`, `read_document` | A Glean server whose admin has not enabled skill discovery. |
| `no-glean` | one unrelated tool | No Glean server: the URL is unset, or the user has not signed in. |

The Glean server is a stub (`claude/servers/glean-stub.mjs`) with made-up data,
so a run needs no Glean sign-in. For the two relay shapes, the baseline build's
real relay runs in front of the stub.

## Cases

Cases are in `claude/cases/`. Each answer exists only in the stub's data, so
the model cannot pass a case by guessing.

- `discovery.json`: tasks in a connected app. Runs on `relay` and `direct`.
- `regression.json`: skills that do not change. Runs on `relay` and `direct`.
- `first-run.json`: the relay before the user has set up Glean. Runs on
  `relay-first-run`.
- `no-discovery.json` and `no-glean.json`: what a skill does, and tells the
  user, when tools are missing. `no-glean.json` covers each skill that tells
  the user how to connect Glean.

## Run

You need Node 22 or later, Claude Code on your `PATH` with a model it can
call, and MST:

```sh
npm install --no-save @gleanwork/mcp-server-tester@2.0.0-rc.4
```

Build the candidate, then prepare and run:

```sh
npm run build
node evals/claude/setup.mjs --candidate dist/claude
cd evals
npx mst run --config claude/.build/relay.eval.json
npx mst run --config claude/.build/relay-first-run.eval.json
npx mst run --config claude/.build/direct.eval.json
npx mst run --config claude/.build/proxy.eval.json
npx mst run --config claude/.build/no-discovery.eval.json
npx mst run --config claude/.build/no-glean.eval.json
```

`setup.mjs` sets the model and the number of trials for every config. It
writes the eval configs with absolute paths, so run it again after you move the
checkout.

The model can see the path of the plugin it runs. So `setup.mjs` copies each
build to `~/.cache/glean-plugins/1` (baseline) and `~/.cache/glean-plugins/2`
(candidate), where the path does not say which build it is. `--work-dir` names
another place.

Each run prints a row per variant and writes a report under
`.mcp-test-results/`. That directory is not committed: it holds full
transcripts.

## Publish

Write the summary of the newest runs, and commit it:

```sh
node evals/claude/summarize.mjs --candidate "<what the candidate is>" > evals/results/<date>-<change>.md
```

The summary holds counts, costs and times. It holds no transcripts.

## Limits

- Each case runs 5 times. That cannot tell a build that always passes from one
  that passes most of the time, so compare trial counts, not single cases.
- The server is a stub. It does not show what a real deployment returns, how
  long it takes, or how sign-in behaves.
- The server's label is `glean`, so tools are named `mcp__glean__<tool>`. An
  installed plugin gives them a longer, plugin-specific prefix.
- Approval prompts are off. Claude Code runs with every permission, and the
  cases call read-only tools.
- Your own Claude Code settings do not apply, but settings your organization
  manages do.
