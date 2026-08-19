# Glean Agent Plugins

The source-of-truth repository for Glean's official plugins for AI coding
assistants. Each plugin is authored once under `shared/`, and
[`pluginpack`](https://github.com/gleanwork/pluginpack)
compiles it into the native plugin layout each host expects — today **Claude
Code**, **Cursor**, and **Codex**. Target overrides handle the few host-specific
setup and capability differences.

## Layout

| Path                           | What it is                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `shared/glean/`                | Canonical Glean plugin: skills, agents, static files, and the local MCP implementation.                            |
| `shared/glean-dev-docs/`       | Canonical source for the separate developer-docs plugin.                                                           |
| `overrides/<target>/<plugin>/` | Target-specific plugin additions and replacements applied after the shared source.                                 |
| `overrides/<target>/root/`     | Target-specific files emitted at the generated marketplace repository root.                                        |
| `pluginpack.config.ts`         | Build config — which shared source, overrides, and content kinds each target includes.                             |
| `dist/<target>/`               | **Generated** marketplace repositories. Don't edit them by hand — they're rebuilt from `shared/` and `overrides/`. |

## Plugins produced

Each target gets two single-purpose plugins:

- **`glean`** — enterprise knowledge: document/Slack/email search, cross-repo
  code exploration, people and experts, meetings, onboarding, and personal
  productivity. Skills auto-trigger by task; there's no per-skill install.
- **`glean-dev-docs`** — searches the public Glean developer documentation
  (separate MCP server, for people _building with_ Glean).

## How it works

`pluginpack` reads `pluginpack.config.ts`, collects the configured skills and
components, and emits each host's native format:

Nothing under `shared/` ships implicitly. Each emitted plugin names its shared
`source`, optional target `overrides`, and any `include` or `exclude` selection in
`pluginpack.config.ts`.

- **Claude Code** — a marketplace + plugin manifest with convention-discovered
  skills, commands, and hooks.
- **Cursor** — a marketplace + `plugin.json` referencing skills, agents, rules,
  and commands.
- **Codex** — a marketplace + `.codex-plugin/plugin.json` for each plugin,
  with bundled skills and install-surface metadata.

Skills use the open Agent Skills format — `SKILL.md` with `name`/`description`
frontmatter and optional `references/` loaded on demand — which Claude Code,
Codex, Cursor, Gemini CLI, and Copilot all support. Shared skills ship to each
target that includes them; target overrides handle host-specific differences.

The Claude, Cursor, and Codex `glean` plugins bundle the local Glean MCP
adapter under `shared/glean/mcp/`. MCP configuration lives in
`mcp/config.json`, while `mcp/pluginpack.json` lists the implementation files
that ship.

## Develop

Requires Node >= 24. Install once with `npm install`.

| Command            | What it does                                             |
| ------------------ | -------------------------------------------------------- |
| `npm run build`    | Compile all targets into the generated plugin output.    |
| `npm run validate` | Validate each target's generated output.                 |
| `npm test`         | Build every target, then validate each generated output. |
| `npm run prune`    | Remove stale generated files.                            |
| `npm run clean`    | Remove all generated output.                             |

### Add or change a skill

1. Edit or create `shared/glean/skills/<name>/SKILL.md` (add `references/*.md` for deep,
   load-on-demand detail).
2. `npm run build` to regenerate the plugins.
3. `npm test` to confirm every target builds and validates cleanly.

Base skill changes reach every target that includes them. When one host needs
different instructions, add a full replacement at
`overrides/<host>/glean/skills/<name>/SKILL.md`; other targets keep the shared file.

### Commit conventions

Releases and the changelog are driven by [Conventional Commits](https://www.conventionalcommits.org/).
In this repo the skill markdown _is_ the shipped product, so:

- Use `feat:` / `fix:` for any change to `shared/` or `overrides/` content —
  it alters what users install, even when the change is "just docs".
- Reserve `docs:` for repo-level documentation that doesn't ship (README,
  contributing notes, etc.).

### Releasing

See [`RELEASE.md`](./RELEASE.md) for how to cut a release and how that flows
into the `claude-plugins`, `cursor-plugins`, and `codex-plugins` repos.
