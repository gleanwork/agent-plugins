# Glean for Cursor

Official Glean plugin for [Cursor](https://cursor.com). Search your company's
knowledge, explore code across repos, find people and experts, and prepare for
meetings, right in your editor.

## Features

- **Email sign-in.** Set up with your work email. The plugin finds your Glean
  instance and signs you in through your browser.
- **Approval before writes.** Tools that change data, such as sending a message
  or creating a ticket, ask you to Allow, Always Allow or Deny first.
- **Built-in Glean tools.** Search, read documents, chat with Glean Assistant,
  memory, user activity, employee search and meeting lookup.
- **Your organization's tools.** Find and run the skills and tools your Glean
  admin has connected.

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
