# Glean for Cursor

Official Glean plugin for [Cursor](https://cursor.com) — enterprise search, code exploration,
and people discovery directly in your development workflow.

## Setup

### 1. Install the plugin

Install from the [Cursor marketplace](https://cursor.com/marketplace/glean).

### 2. Configure your Glean MCP server

Visit the [Glean MCP configurator](https://app.glean.com/settings/install?mcpConfigure=true&mcpHost=cursor) to get your server URL, then add it to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "glean": {
      "url": "YOUR-GLEAN-MCP-URL"
    }
  }
}
```

Restart Cursor after editing — OAuth authentication is handled automatically on first use.

## What's Included

### Skills

| Skill | Description |
| ----- | ----------- |
| `enterprise-search` | Search company docs, wikis, policies, and internal knowledge |
| `search` | Structured Glean search with result vetting and quality assessment |
| `mcp-setup` | Configure a Glean MCP server connection in Cursor |
| `mcp-status` | Check the status of your Glean MCP connection |
| `glean-tools-guide` | Reference for selecting the right Glean tool |
| `confidence-signals` | Communicate reliability and freshness of Glean results |
| `meeting-context` | Find decisions and action items from meetings |
| `people-lookup` | Find people by role, team, or expertise |
| `synthesis-patterns` | Combine results across multiple Glean sources |
| `code-exploration` | Explore code across your org's repositories |
| `code-owners` | Identify who owns or maintains a code area |
| `codebase-context` | Get architectural context from internal repositories |
| `find-examples` | Find usage examples of APIs or patterns across the org |
| `plan-prep` | Research enterprise context before planning a feature |
| `similar-code` | Find similar implementations across repos |
| `find-expert` | Find subject matter experts based on contributions |
| `stakeholders` | Identify stakeholders for a change or project |

### Agents

| Agent | Description |
| ----- | ----------- |
| `enterprise-searcher` | Searches enterprise knowledge across documents, Slack, and email |
| `people-finder` | Finds people by role, expertise, or org relationship |
| `codebase-navigator` | Navigates internal code repos to find implementations and trace dependencies |
| `plan-prep-researcher` | Researches enterprise context and similar patterns for planning tasks |

### Commands

| Command | Description |
| ------- | ----------- |
| `/mcp-setup` | Walk through Glean MCP server setup |
| `/mcp-status` | Check your Glean MCP connection |
| `/search` | Search Glean enterprise knowledge |
| `/code-owners` | Find who owns a code area |
| `/codebase-context` | Get architectural context for a system |
| `/find-examples` | Find usage examples across repos |
| `/plan-prep` | Research context before entering plan mode |
| `/similar-code` | Find similar implementations |
| `/find-expert` | Find experts on a topic |
| `/stakeholders` | Identify stakeholders for a change |

## Requirements

- [Cursor](https://cursor.com) (latest version)
- A Glean account with MCP access
- Your Glean MCP server URL (get it from the [Glean MCP configurator](https://app.glean.com/settings/install?mcpConfigure=true&mcpHost=cursor))

## Support

- [Glean MCP Documentation](https://docs.glean.com/mcp)
- [Glean Support](https://help.glean.com)
- [GitHub Issues](https://github.com/gleanwork/cursor-plugins/issues)

## License

MIT — see [LICENSE](LICENSE) for details.
