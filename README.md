# Glean Agent Plugins

The source-of-truth repository for Glean's official plugins for AI coding
assistants. One portable library of skills, agents, rules, commands, and hooks
is authored here once, and [`pluginpack`](https://github.com/gleanwork/pluginpack)
compiles it into the native plugin layout each host expects — today **Claude
Code**, **Cursor**, and **Codex**. Most skills share one base source; target
overrides handle the few host-specific setup and capability differences.

## Layout

| Path | What it is |
|------|------------|
| `skills/` | The portable skill library — one `SKILL.md` (plus optional `references/`) per capability, with host-specific files only under `targets/<host>/`. **The source of truth.** |
| `sources/shared/` | Components shared by targets that support them (subagents). |
| `sources/claude/` | Claude-only components (slash-commands, hooks). |
| `sources/codex/` | Codex-only plugin documentation and static files. |
| `sources/cursor/` | Cursor-only components (rules, commands, assets). |
| `sources/dev-docs/` | Source for the separate `glean-dev-docs` plugin. |
| `pluginpack.config.ts` | Build config — which sources compose into which plugin, per target. |
| `plugins/`, `glean/`, `glean-dev-docs/`, `.agents/`, `.codex-plugin/`, `.claude-plugin/`, `.cursor-plugin/` | **Generated** output. Don't edit by hand — it's rebuilt from source. |

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
- **Codex** — a marketplace + `.codex-plugin/plugin.json` for each plugin,
  with bundled skills and install-surface metadata.

Skills use the open Agent Skills format — `SKILL.md` with `name`/`description`
frontmatter and optional `references/` loaded on demand — which Claude Code,
Codex, Cursor, Gemini CLI, and Copilot all support. Base skills ship everywhere;
target overrides handle the few host-specific differences.

> The plugins don't bundle a Glean MCP server — users connect one themselves
> (your host's Glean MCP setup guides that). The skills then use whatever Glean MCP
> tools are available in the host.

## Develop

Requires Node >= 24. Install once with `npm install`.

| Command | What it does |
|---------|--------------|
| `npm run build` | Compile all targets into the generated plugin output. |
| `npm run validate` | Validate each target's generated output. |
| `npm test` | Build every target, then validate each generated output. |
| `npm run prune` | Remove stale generated files. |
| `npm run clean` | Remove all generated output. |

### Add or change a skill

1. Edit or create `skills/<name>/SKILL.md` (add `references/*.md` for deep,
   load-on-demand detail).
2. `npm run build` to regenerate the plugins.
3. `npm test` to confirm every target builds and validates cleanly.

Base skill changes reach every target that includes them. When one host needs
different instructions, add a full replacement at
`skills/<name>/targets/<host>/SKILL.md`; other targets keep the base file.

### Commit conventions

Releases and the changelog are driven by [Conventional Commits](https://www.conventionalcommits.org/).
In this repo the skill markdown *is* the shipped product, so:

- Use `feat:` / `fix:` for any change to `skills/` or `sources/` content —
  it alters what users install, even when the change is "just docs".
- Reserve `docs:` for repo-level documentation that doesn't ship (README,
  contributing notes, etc.).
