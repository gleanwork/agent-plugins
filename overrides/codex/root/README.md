# Glean Plugins for Codex

> **Generated repository.** Built from
> [gleanwork/agent-plugins](https://github.com/gleanwork/agent-plugins) via
> [pluginpack](https://github.com/gleanwork/pluginpack). Don't hand-edit managed
> files here — changes are made in `agent-plugins` and synced through generated
> pull requests.

Official Glean plugins for [Codex](https://developers.openai.com/codex) —
enterprise knowledge, search, people, code, meetings, and Glean developer docs.

## Install

```bash
codex plugin marketplace add gleanwork/codex-plugins
codex plugin add glean@glean-codex-plugins
codex plugin add glean-dev-docs@glean-codex-plugins
```

Start Codex and prompt the harness to set up Glean, for example: `Set up Glean
for me`. Complete the browser OAuth flow when prompted.

The **Glean developer docs** plugin uses a separate public MCP server. If you
installed that plugin, add it before starting a new Codex task:
`codex mcp add glean-dev-docs --url https://developers.glean.com/mcp`.

Then start a new Codex task so the bundled skills and MCP tools are available.

## Plugins

| Plugin | Description |
|--------|-------------|
| **[glean](plugins/glean)** | Enterprise knowledge — search docs/Slack/email, cross-repo code exploration, people & experts, meetings, onboarding, and productivity. |
| **[glean-dev-docs](plugins/glean-dev-docs)** | Search Glean's public developer documentation — APIs, SDKs, MCP, and integration guides. |

## Requirements

- [Codex](https://developers.openai.com/codex) with plugin support
- A Glean account with MCP access (for the `glean` plugin)

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/codex-plugins/issues)

## License

MIT License — see [LICENSE](LICENSE) for details.
