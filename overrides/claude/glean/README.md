# Glean

Official Glean plugin for Claude — enterprise search, code exploration, and
people discovery in your development workflow.

## Setup in Claude Code

### 1. Install the plugin

Install `glean` from the plugin marketplace.

### 2. Set your Glean server URL

Claude Code asks for the URL of your Glean MCP server when you install the
plugin. It looks like `https://acme-be.glean.com/mcp/default`. Your Glean admin
has it, in the
[Glean admin settings](https://app.glean.com/admin/about-glean).

To set or change it later, open `/plugin`, choose Glean, and set the server
URL. Then run `/reload-plugins`.

### 3. Sign in

Run `/mcp`, choose the Glean server, and sign in. Your browser opens for the
Glean sign-in.

### Updating from version 3

Version 3 ran a local server on your machine. This version connects Claude Code
to your Glean server directly.

The first session after the update carries your saved server URL over. Run
`/reload-plugins`, then sign in under `/mcp`. You sign in once more because
Claude Code now holds its own token.

## Claude chat and Cowork

The plugin adds its skills. The Glean tools come from the Glean connector that
your admin sets up for your organization, so there is no server URL to set.

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

The skills use the tools your Glean MCP server offers. Your Glean admin decides
which tools those are.

## Requirements

- Claude Code 2.1.274 or later. Earlier versions cannot show Glean's approval
  prompt for actions that change data.
- A Glean account with MCP access
- The URL of your Glean MCP server

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/agent-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
