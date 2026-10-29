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

{{> glean-readme-local-server}}

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

{{> glean-readme-skills}}

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

{{> glean-readme-support}}
