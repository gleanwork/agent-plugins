# Glean

Official Glean plugin for [Claude](https://claude.com). Search your company's
knowledge, explore code across repos, find people and experts, and prepare for
meetings.

## Where it works

The plugin has two parts, and they work in different places:

- **Skills** load wherever Claude loads plugins. Agents run in Claude Code and
  Cowork.
- **Glean tools** come from a local MCP server that the plugin starts. Glean
  supports it in Claude Code.

| Surface                    | Skills | Glean tools                     |
| -------------------------- | ------ | ------------------------------- |
| Claude Code                | Yes    | Yes, from the plugin            |
| Cowork                     | Yes    | Add Glean as a custom connector |
| Claude chat                | Yes    | Add Glean as a custom connector |
| Claude Code cloud sessions | No     | Add Glean as a custom connector |

For a custom connector, use your Glean MCP server URL
(`[server-url]/mcp/[server-name]`, available from your
[Glean admin](https://app.glean.com/admin/about-glean)). The skills use
whichever Glean tools are connected.

### Why a local server?

It does two things that hosts can't do with Glean yet:

- **Sign-in.** Each Glean instance has its own MCP URL. The local server finds
  yours from your work email and signs you in through your browser.
- **Approval before writes.** Glean asks you to approve tools that change data,
  such as sending a message or creating a ticket. Hosts on MCP versions before
  2026-07-28 can't show Glean's prompt, so the local server shows it instead.

## Setup

### 1. Install the plugin

In Claude Code:

```
/plugin marketplace add gleanwork/claude-plugins
/plugin install glean@glean-plugins
```

In Claude Desktop or Cowork, open **Customize → Plugins**, add the
`gleanwork/claude-plugins` marketplace, and install **Glean**.

### 2. Set up Glean

In Claude Code, ask Claude: `Set up Glean for me`. Enter your work email when
asked, then finish signing in in your browser.

Everywhere else, add Glean as a custom connector.

## What's Included

The plugin ships a library of skills (plus supporting agents) that auto-trigger
by task — there's no per-skill install. They cover:

- **Enterprise search & knowledge** — find documents, Slack messages, and email; vet results for freshness and authority.
- **Code across repos** — explore implementations, find usage examples and similar code, identify code owners, and gather architectural context.
- **People & org** — find experts by contribution, and identify stakeholders for a change or project.
- **Meetings** — prep for upcoming meetings and catch up on what you missed.
- **Onboarding & projects** — ramp up on a team or area, read quick project status, and generate comprehensive project handoffs.
- **Personal productivity** — summarize your own activity, prep status updates, and surface what needs your attention.
- **Skill authoring** — discover automation opportunities and generate new skills.

## Requirements

- A Glean account with MCP access
- For Glean tools in Claude Code: [Node.js](https://nodejs.org) 22 or later

## Privacy

The plugin connects only to Glean:

- During setup, it sends your work email to `app.glean.com` to find your Glean
  instance.
- Requests to your Glean instance include the plugin and Claude Code versions,
  and the Glean MCP servers configured in Claude Code. Other MCP servers are
  counted, not named.
- Sign-in tokens and caches stay on your computer, in Claude Code's plugin data
  folder or `~/.glean`.

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
