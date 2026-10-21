# Glean Plugins

> **Generated repository.** Built from
> [gleanwork/agent-plugins](https://github.com/gleanwork/agent-plugins) via
> [pluginpack](https://github.com/gleanwork/pluginpack). Don't hand-edit managed
> files here — changes are made in `agent-plugins` and synced through generated
> pull requests.

Official Glean plugins in the [Agent Plugins](https://agent-plugins.org/specification)
format — enterprise knowledge, search, people, code, meetings, and Glean
developer docs. One package per plugin works in every client that supports the
format.

## Install

### Codex

```bash
codex plugin marketplace add gleanwork/glean-plugins
codex plugin add glean@glean-plugins
codex plugin add glean-dev-docs@glean-plugins
```

### GitHub Copilot CLI

```bash
copilot plugin marketplace add gleanwork/glean-plugins
copilot plugin install glean@glean-plugins
copilot plugin install glean-dev-docs@glean-plugins
```

Then start a new session and prompt the harness to set up Glean, for example:
`Set up Glean for me`. Complete the browser OAuth flow when prompted.

The **Glean developer docs** plugin uses a separate public MCP server. If you
installed that plugin, add it before starting a new session:

```bash
codex mcp add glean-dev-docs --url https://developers.glean.com/mcp
copilot mcp add --transport http glean-dev-docs https://developers.glean.com/mcp
```

## Plugins

| Plugin | Description |
|--------|-------------|
| **[glean](plugins/glean)** | Enterprise knowledge — search docs/Slack/email, cross-repo code exploration, people & experts, meetings, onboarding, and productivity. |
| **[glean-dev-docs](plugins/glean-dev-docs)** | Search Glean's public developer documentation — APIs, SDKs, MCP, and integration guides. |

## Layout

- `plugins/<name>/` — one Agent Plugins package per plugin: `plugin.json`,
  `mcp.json`, and `skills/`. Copilot's custom agents are in
  `plugins/glean/com.github.copilot/agents/`.
- `.agents/plugins/marketplace.json` — the Codex marketplace.
- `.github/plugin/marketplace.json` — the Copilot marketplace.

## Requirements

- A client that supports Agent Plugins, such as
  [Codex](https://developers.openai.com/codex) or
  [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli)
- A Glean account with MCP access (for the `glean` plugin)

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT License — see [LICENSE](LICENSE) for details.
