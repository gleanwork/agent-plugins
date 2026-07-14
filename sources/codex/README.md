# Glean for Codex

Official Glean plugin for [Codex](https://developers.openai.com/codex) — enterprise search,
code exploration, and people discovery directly in your development workflow.

## Setup

### 1. Install the plugin

```bash
codex plugin marketplace add gleanwork/codex-plugins
codex plugin add glean@glean-codex-plugins
```

### 2. Configure your Glean MCP server

Get your server URL and server name from the
[Glean MCP configurator](https://app.glean.com/settings/install?mcpConfigure=true), then run:

```bash
codex mcp add glean --url https://YOUR-INSTANCE-be.glean.com/mcp/YOUR-SERVER-NAME
codex mcp login glean
```

Complete the browser OAuth flow, then verify with `codex mcp list`. Start a new
Codex task so both the bundled skills and Glean MCP tools are available.

## What's Included

The plugin ships a library of skills that auto-trigger by task — there's no
per-skill install. They cover:

- **Enterprise search & knowledge** — find documents, Slack messages, and email; vet results for freshness and authority.
- **Code across repos** — explore implementations, find usage examples and similar code, identify code owners, and gather architectural context.
- **People & org** — find experts by contribution, and identify stakeholders for a change or project.
- **Meetings** — prep for upcoming meetings and catch up on what you missed.
- **Onboarding & projects** — ramp up on a team or area, read quick project status, and generate comprehensive project handoffs.
- **Personal productivity** — summarize your own activity, prep status updates, and surface what needs your attention.
- **Skill authoring** — discover automation opportunities and generate new skills.

## Requirements

- [Codex](https://developers.openai.com/codex) with plugin support
- A Glean account with MCP access
- Your Glean MCP server URL and server name

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
