# Glean

Official Glean plugin in the [Agent Plugins](https://agent-plugins.org/specification)
format — enterprise search, code exploration, and people discovery directly in
your development workflow. Works in Codex and GitHub Copilot CLI.

## Setup

### 1. Install the plugin

Codex:

```bash
codex plugin marketplace add gleanwork/glean-plugins
codex plugin add glean@glean-plugins
```

GitHub Copilot CLI:

```bash
copilot plugin marketplace add gleanwork/glean-plugins
copilot plugin install glean@glean-plugins
```

### 2. Set up Glean

Start a new session and prompt the harness: `Set up Glean for me`. Complete
the browser OAuth flow when prompted, then start a new session so both the
bundled skills and Glean MCP tools are available.

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

In Copilot, the plugin also adds custom agents for focused research tasks,
such as people discovery and meeting analysis.

## Requirements

- A client that supports Agent Plugins, such as
  [Codex](https://developers.openai.com/codex) or
  [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli)
- A Glean account with MCP access

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
