---
name: mcp-setup
description: Configure a Glean MCP server connection for Cursor
---

# Glean MCP Server Setup

Help the user configure a Glean MCP server for Cursor. This command can be run multiple times to add multiple servers.

## Setup Flow

### Step 1: Get Server URL

Ask the user for their Glean server URL. They can find it at <https://app.glean.com/admin/about-glean>.

### Step 2: Get Server Name

Ask the user for the server name they want to connect to. Explain that their Glean administrator should have provided this. Common examples include `default`, but server names are organization-specific.

### Step 3: Configure MCP Server

Once you have both values, instruct the user to add the following to their `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "glean": {
      "url": "[server-url]/mcp/[server-name]"
    }
  }
}
```

Replace `[server-url]` with their server URL (e.g. `https://acme-be.glean.com` or `https://be-4f5226e2.glean.com`) and `[server-name]` with the server name.

### Step 4: Confirm Success

After configuration:

1. Confirm the server entry was added to `~/.cursor/mcp.json`
2. Remind the user to restart Cursor to activate the new server
3. Explain that they'll be prompted to authenticate on first use (OAuth)
4. Offer to run `/mcp-setup` again if they want to add another server

## Important Notes

- The URL format is: `[server-url]/mcp/[server-name]`
- Cursor handles OAuth authentication automatically on first tool use
- The MCP configuration file is at `~/.cursor/mcp.json`
