---
name: mcp-status
description: Check Glean MCP server connection status
---

# Glean Connection Status

Check the status of configured Glean MCP servers.

## Steps

### 1. Check MCP Configuration

Look for Glean MCP server entries in the user's `~/.cursor/mcp.json` file. Search for any entries with URLs matching `glean.com/mcp`.

### 2. Analyze Results

Check if the configuration file exists and contains Glean server entries.

### 3. Report Status

**If Glean servers are found:**
- List each Glean server by name
- Show the URL for each
- Confirm they are configured

**If no Glean servers are found:**
- Inform the user that no Glean MCP servers are configured
- Suggest running `/mcp-setup` to configure one
- Provide a brief explanation of what Glean MCP enables

### 4. Test Connectivity (Optional)

If the user wants to verify the connection is working, suggest they try a simple search. Remind them that on first use, they'll be prompted to authenticate via OAuth.

## Example Output Format

```
Glean MCP Status:

Configured Servers:
  - glean: https://acme-be.glean.com/mcp/default (your URL may differ)

Status: Ready (authentication will be prompted on first use)
```

Or if none configured:

```
Glean MCP Status:

No Glean MCP servers configured.

Run /mcp-setup to configure a Glean MCP server.
```
