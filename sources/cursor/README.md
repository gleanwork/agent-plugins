# Glean for Cursor

Official Glean plugin for [Cursor](https://cursor.com) — enterprise search, code exploration,
and people discovery directly in your development workflow.

## Setup

### 1. Install the plugin

Install from the [Cursor marketplace](https://cursor.com/marketplace/glean).

### 2. Configure your Glean MCP server

Visit the [Glean MCP configurator](https://app.glean.com/settings/install?mcpConfigure=true&mcpHost=cursor) to get your server URL, then add it to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "glean": {
      "url": "YOUR-GLEAN-MCP-URL"
    }
  }
}
```

Restart Cursor after editing — OAuth authentication is handled automatically on first use.

## What's Included

The plugin ships a library of skills (plus supporting agents and rules) that
auto-trigger by task — there's no per-skill install. They cover:

- **Enterprise search & knowledge** — find documents, Slack messages, and email; vet results for freshness and authority.
- **Code across repos** — explore implementations, find usage examples and similar code, identify code owners, and gather architectural context.
- **People & org** — find experts by contribution, and identify stakeholders for a change or project.
- **Meetings** — prep for upcoming meetings and catch up on what you missed.
- **Onboarding & projects** — ramp up on a team or area, read quick project status, and generate comprehensive project handoffs.
- **Personal productivity** — summarize your own activity, prep status updates, and surface what needs your attention.
- **Skill authoring** — discover automation opportunities and generate new skills.

Glean tools are used through whatever Glean MCP server is connected in Cursor;
if none is configured, see your host's Glean MCP setup (above).

## Requirements

- [Cursor](https://cursor.com) (latest version)
- A Glean account with MCP access
- Your Glean MCP server URL (get it from the [Glean MCP configurator](https://app.glean.com/settings/install?mcpConfigure=true&mcpHost=cursor))

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
