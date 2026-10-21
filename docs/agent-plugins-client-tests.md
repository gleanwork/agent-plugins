# Agent Plugins client tests

How each client loads the Glean plugin when it ships as an
[Agent Plugins](https://agent-plugins.org/specification) package.

## Package under test

The `codex` output of [#35](https://github.com/gleanwork/agent-plugins/pull/35)
(commit `988eba1`), built with pluginpack `main` plus
[gleanwork/pluginpack#41](https://github.com/gleanwork/pluginpack/pull/41).
That is the 0.12.0 release contents. The package is
`dist/codex/plugins/glean/`:

- `plugin.json` with the Agent Plugins 1.0 `$schema` and Codex settings under
  `extensions["com.openai"]`
- `mcp.json` with one stdio server, `glean_plugin`: `node ./mcp/start.mjs`,
  with no `cwd`
- `skills/` with 19 skills

Every client below ran with an isolated config directory, so no installed
plugin affected the results.

## Results

| Client | Version | Result |
| --- | --- | --- |
| Codex | 0.160.1 | Pass: installs from the marketplace, registers the MCP server, the server starts |
| GitHub Copilot CLI | 1.0.100 | Pass: installs, loads 19 skills, registers the MCP server, the server starts |
| Claude Code | 2.1.284 | Pass: ignores the root `plugin.json` and `mcp.json` |
| VS Code | not run | needs a GUI session |
| Cursor | not run | needs a GUI session |

"The server starts" means: the server was launched with the command, `cwd`
and environment the client reports, then answered `initialize` with
`glean 3.5.1` and `tools/list` with `find_skills_and_tools`, `run_tool` and
`setup`. Glean sign-in, tool calls and approval prompts were not exercised.

### Codex

```sh
CODEX_HOME=$(mktemp -d) codex plugin marketplace add dist/codex
codex plugin add glean@glean-codex-plugins
codex mcp list --json
```

Codex runs the server with `cwd` set to the installed plugin root, so
`./mcp/start.mjs` resolves without a `cwd` field. It sets `PLUGIN_ROOT` and
`PLUGIN_DATA`, but not `CLAUDE_PLUGIN_DATA`.

### GitHub Copilot CLI

```sh
COPILOT_HOME=$(mktemp -d) npx @github/copilot plugin install dist/codex/plugins/glean
npx @github/copilot plugin list --json
npx @github/copilot mcp list --json
```

The install reports `Installed 19 skills`. Copilot reads `mcp.json` and runs
the server with `cwd: "${PLUGIN_ROOT}"`. It sets `PLUGIN_ROOT`, `PLUGIN_DATA`,
and the `CLAUDE_*` and `COPILOT_*` forms of both.

Copilot also warns that installing from a path is deprecated:

> Direct plugin installs (repos, URLs, local paths) are deprecated. Only
> plugin@marketplace installs will be supported in a future release.

So the Copilot release needs a marketplace entry. pluginpack's
`agent-plugins` target builds one when `clients` lists `copilot`
([gleanwork/pluginpack#42](https://github.com/gleanwork/pluginpack/pull/42)).

### Claude Code

The test copied `dist/claude/plugins/glean/` twice and added the package's
`plugin.json` and `mcp.json` to one copy. Then it ran both copies through
validation and a headless session:

```sh
claude plugin validate --strict <dir>
claude -p --output-format stream-json --verbose --max-turns 1 --plugin-dir <dir> "Reply with OK."
```

Both copies pass `--strict` validation. The session `init` events are
identical: one `glean_plugin` MCP server (connected), the same 19 skills, and
the same 10 agents. Both list `glean:glean-run`, the renamed skill, which
confirms the session loaded the test directory and not the installed plugin.
Claude Code ignores the root `plugin.json` and `mcp.json`, so one directory
can carry both manifests.

## Finding: the data directory differs by client

`shared/glean/mcp/start.mjs` stores credentials and caches in
`CLAUDE_PLUGIN_DATA`, or in `~/.glean` when that variable is unset:

| Client | Variables set for the MCP server | Data directory used |
| --- | --- | --- |
| Claude Code | not checked in this test | not checked |
| Copilot CLI | `PLUGIN_DATA`, `CLAUDE_PLUGIN_DATA`, `COPILOT_PLUGIN_DATA` | the plugin's data directory |
| Codex | `PLUGIN_DATA` | `~/.glean` |

Codex users keep using `~/.glean` after the layout change, so nothing moves
for them. If `start.mjs` starts reading the standard `PLUGIN_DATA`, Codex
users would sign in again, because their stored credentials stay in
`~/.glean`. Decide that separately.

## Still to test

- **Copilot CLI, live session:** after `copilot login`, check that the skills
  trigger, Glean sign-in completes, and approval prompts appear.
- **VS Code:** install with **Chat: Install Plugin From Source** pointing at
  the package directory, then run the same checks.
- **Cursor:** copy the package to `~/.cursor/plugins/local/glean` and reload.
  Check that the MCP server starts from `./mcp/start.mjs` (Cursor doesn't
  expand `${PLUGIN_ROOT}`). Then add `.cursor-plugin/plugin.json` from the
  Cursor build and check which manifest Cursor loads.
