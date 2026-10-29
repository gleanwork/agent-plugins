# Glean for Codex

Official Glean plugin for [Codex](https://developers.openai.com/codex). Search
your company's knowledge, explore code across repos, find people and experts,
and prepare for meetings, right in your terminal.

## Where it works

The plugin has two parts:

- **Skills** that Codex loads from the plugin.
- **Glean tools** from a local MCP server that the plugin starts.

| Surface                          | Skills            | Glean tools               |
| -------------------------------- | ----------------- | ------------------------- |
| Codex CLI                        | Yes               | Yes, from the plugin      |
| Codex in the ChatGPT desktop app | Not supported yet | Not supported yet         |
| Codex IDE extension              | No                | Add your Glean MCP server |

The Codex IDE extension doesn't support plugins. To add your Glean MCP server
there, use its URL (`[server-url]/mcp/[server-name]`, available from your
[Glean admin](https://app.glean.com/admin/about-glean)):

```bash
codex mcp add glean --url [server-url]/mcp/[server-name]
codex mcp login glean
```

### Why a local server?

Glean asks you to approve tools that change data, such as sending a message or
creating a ticket. Hosts on MCP versions before 2026-07-28 can't show Glean's
prompt, so the plugin's local server shows it instead.

## Setup

### 1. Install the plugin

```bash
codex plugin marketplace add gleanwork/codex-plugins
codex plugin add glean@glean-codex-plugins
```

### 2. Set up Glean

Start a new Codex task and ask: `Set up Glean for me`. Enter your work email
when asked, then finish signing in in your browser. Start a new task so both
the bundled skills and Glean tools are available.

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
- [Node.js](https://nodejs.org) 22 or later
- A Glean account with MCP access

## Privacy

The plugin connects only to Glean:

- During setup, it sends your work email to `app.glean.com` to find your Glean
  instance.
- Requests to your Glean instance include the plugin and Codex versions.
- Sign-in tokens and caches stay on your computer, in `~/.glean`.

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
