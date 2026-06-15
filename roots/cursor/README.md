# Glean Plugins for Cursor

> **Generated repository.** Built from
> [gleanwork/agent-plugins](https://github.com/gleanwork/agent-plugins) via
> [pluginpack](https://github.com/gleanwork/pluginpack). Don't hand-edit managed
> files here — changes are made in `agent-plugins` and synced down automatically.

Official Glean plugins for [Cursor](https://cursor.com) — enterprise knowledge,
search, code exploration, and people discovery, right in your editor.

## What's new in v3.0.0

- The **`glean`** plugin is refreshed with the latest consolidated skills and
  agents (search, code exploration, people, meetings, onboarding, productivity).
  Your existing `glean` install updates in place — no migration needed.
- A new **`glean-dev-docs`** plugin searches Glean's public developer
  documentation (APIs, SDKs, MCP) — install it if you build *with* Glean.

## Install

Add the **`gleanwork/cursor-plugins`** marketplace in Cursor, then install the
**`glean`** plugin (and **`glean-dev-docs`** if you build with Glean). Once
installed, ask Cursor to "set up Glean" and the `glean` plugin's `connect-glean`
skill walks you through connecting a Glean MCP server.

## Plugins

| Plugin | Description |
|--------|-------------|
| **[glean](glean)** | Enterprise knowledge — search docs/Slack/email, cross-repo code exploration, people & experts, meetings, onboarding, productivity. |
| **[glean-dev-docs](glean-dev-docs)** | Search Glean's public developer documentation — APIs, SDKs, MCP, and integration guides. |

## License

MIT License - see [LICENSE](LICENSE) for details.
