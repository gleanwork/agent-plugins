# Glean Developer Docs

Search the public [Glean developer documentation](https://docs.glean.com) — APIs, SDKs,
MCP, authentication, indexing, and integration guides for building *with* Glean.

This is a separate, focused plugin for people building on the Glean platform. For
searching your own company's internal knowledge, use the main **Glean** plugin instead.

## Setup

### 1. Install the plugin

Install `glean-dev-docs@glean-plugins` from the `gleanwork/glean-plugins`
marketplace in Codex or GitHub Copilot CLI.

### 2. Configure the Glean Dev Docs MCP server

This plugin uses the public Glean Developer Docs MCP server. No Glean account
is required. Add it with:

```bash
# Codex
codex mcp add glean-dev-docs --url https://developers.glean.com/mcp

# GitHub Copilot CLI
copilot mcp add --transport http glean-dev-docs https://developers.glean.com/mcp
```

Start a new session so the MCP tools are available.

## What's Included

A single skill that auto-triggers when you ask about building with Glean — API
syntax, SDK usage, MCP setup, indexing, authentication, and platform integration.
It searches the public developer documentation and returns cited answers.

## Support

- [Glean Developer Documentation](https://docs.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
