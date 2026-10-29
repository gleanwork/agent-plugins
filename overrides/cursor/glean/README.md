# Glean for Cursor

Official Glean plugin for [Cursor](https://cursor.com). Search your company's
knowledge, explore code across repos, find people and experts, and prepare for
meetings, right in your editor.

## Where it works

The plugin has two parts:

- **Skills, agents and rules** that Cursor loads from the plugin.
- **Glean tools** from a local MCP server that the plugin starts.

| Surface                        | Skills            | Glean tools                     |
| ------------------------------ | ----------------- | ------------------------------- |
| Cursor editor and Agent Window | Yes               | Yes, from the plugin            |
| Cursor CLI                     | Not supported yet | Add your Glean MCP server       |
| Cursor Cloud Agents            | Not supported yet | Add your Glean MCP server       |

To add your Glean MCP server, put its URL (`[server-url]/mcp/[server-name]`,
available from your [Glean admin](https://app.glean.com/admin/about-glean)) in
Cursor's MCP settings.

### Why a local server?

Glean asks you to approve tools that change data, such as sending a message or
creating a ticket. Hosts on MCP versions before 2026-07-28 can't show Glean's
prompt, so the plugin's local server shows it instead.

## Setup

### 1. Install the plugin

Install from the [Cursor marketplace](https://cursor.com/marketplace/glean).

### 2. Set up Glean

Ask the agent: `Set up Glean for me`. Enter your work email when asked, then
finish signing in in your browser.

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

## Requirements

- [Cursor](https://cursor.com) (latest version)
- [Node.js](https://nodejs.org) 22 or later
- A Glean account with MCP access

## Privacy

The plugin connects only to Glean:

- During setup, it sends your work email to `app.glean.com` to find your Glean
  instance.
- Requests to your Glean instance include the plugin and Cursor versions.
- Sign-in tokens and caches stay on your computer, in `~/.glean`.

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
