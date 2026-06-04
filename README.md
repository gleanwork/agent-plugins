# Glean Agent Plugins

The source-of-truth repository for Glean's official plugins for AI coding
assistants. One portable library of skills, agents, rules, commands, and hooks
is authored here once, and [`pluginpack`](https://github.com/gleanwork/pluginpack)
compiles it into the native plugin layout each host expects — today **Claude
Code** and **Cursor**. The same skills ship to every target; only each host's
manifest layer differs, and pluginpack generates that.

## Layout

| Path | What it is |
|------|------------|
| `skills/` | The portable skill library — one `SKILL.md` (plus optional `references/`) per capability, in the open Agent Skills format. Host-agnostic; **the source of truth.** |
| `sources/shared/` | Components shared by every target (subagents). |
| `sources/claude/` | Claude-only components (slash-commands, hooks). |
| `sources/cursor/` | Cursor-only components (rules, commands, assets). |
| `sources/dev-docs/` | Source for the separate `glean-dev-docs` plugin. |
| `pluginpack.config.ts` | Build config — which sources compose into which plugin, per target. |
| `plugins/`, `glean/`, `glean-dev-docs/`, `.claude-plugin/`, `.cursor-plugin/` | **Generated** output. Don't edit by hand — it's rebuilt from source. |

## Plugins produced

Each target gets two single-purpose plugins:

- **`glean`** — enterprise knowledge: document/Slack/email search, cross-repo
  code exploration, people and experts, meetings, onboarding, and personal
  productivity. Skills auto-trigger by task; there's no per-skill install.
- **`glean-dev-docs`** — searches the public Glean developer documentation
  (separate MCP server, for people *building with* Glean).

## How it works

`pluginpack` reads `pluginpack.config.ts`, collects the configured skills and
components, and emits each host's native format:

- **Claude Code** — a marketplace + plugin manifest with convention-discovered
  skills, commands, and hooks.
- **Cursor** — a marketplace + `plugin.json` referencing skills, agents, rules,
  and commands.

Skills use the open Agent Skills format — `SKILL.md` with `name`/`description`
frontmatter and optional `references/` loaded on demand — which Claude Code,
Cursor, Gemini CLI, and Copilot all support. Write a skill once; it ships
everywhere, and per-host quirks are neutralized at build time.

> The plugins don't bundle a Glean MCP server — users connect one themselves
> (your host's Glean MCP setup guides that). The skills then use whatever Glean MCP
> tools are available in the host.

## Develop

Requires Node >= 24. Install once with `npm install`.

| Command | What it does |
|---------|--------------|
| `npm run build` | Compile all targets into the generated plugin output. |
| `npm run validate` | Validate each target's generated output. |
| `npm test` | Diff a fresh build against the committed output (staleness gate). |
| `npm run prune` | Remove stale generated files. |
| `npm run clean` | Remove all generated output. |

### Add or change a skill

1. Edit or create `skills/<name>/SKILL.md` (add `references/*.md` for deep,
   load-on-demand detail).
2. `npm run build` to regenerate the plugins.
3. `npm test` to confirm the output is well-formed and in sync.

Because every target compiles from the same `skills/` source, a change lands in
all of them at once.
