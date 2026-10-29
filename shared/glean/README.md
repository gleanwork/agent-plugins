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

{{> glean-readme-local-server}}

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

{{> glean-readme-skills}}

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

{{> glean-readme-support}}
