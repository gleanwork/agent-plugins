---
name: connect-glean
description: Help the user connect a Glean MCP server so the Glean skills have tools to call — use when setting up Glean for the first time, adding another Glean server, checking whether Glean is connected, or troubleshooting missing Glean tools. Trigger phrases include "set up Glean", "connect Glean", "configure Glean MCP", "add a Glean server", "is Glean connected", "check Glean status", "Glean isn't working", "no Glean tools", "the Glean tools aren't showing up", "I installed the Glean plugin but nothing happens". Don't use it for actual enterprise queries once connected (use the using-glean skill); this skill only sets up and verifies the connection.
---

# Connect Glean

The Glean plugin ships skills but **does not bundle an MCP server** — the skills
call whatever Glean MCP tools Codex exposes. If no Glean MCP server is connected,
the skills have nothing to call. This skill connects one, or verifies and
troubleshoots an existing connection.

## When this applies

- **First-time setup** — the Glean plugin is installed but no Glean tools appear.
- **Adding another server** — e.g. a second backend or a code-search server.
- **Status / troubleshooting** — "is Glean connected?", "no Glean tools showing".

## What you need first

Gather these once, then use them in the Codex setup below:

1. **Server URL** — the Glean backend, found at
   <https://app.glean.com/admin/about-glean>. Looks like
   `https://acme-be.glean.com` or `https://be-4f5226e2.glean.com`.
2. **Server name** — organization-specific, from the user's Glean admin. Often
   `default`.
3. **Friendly name** — what to call it in the host. Use `glean` for a single
   server, or `glean-<server-name>` when adding several (e.g. `glean-default`,
   `glean-code`).

The MCP endpoint is always `<server-url>/mcp/<server-name>`. It is a **remote
HTTP** server and uses OAuth — there is no API key to paste.

## Configure Codex

Run:

```bash
codex mcp add <friendly-name> --url <server-url>/mcp/<server-name>
codex mcp login <friendly-name>
```

Complete the browser OAuth flow, then verify with `codex mcp list` (look for a
`glean.com/mcp` URL). Start a new Codex task so the MCP tools are available.

## Checking status / troubleshooting "no Glean tools"

If the Glean skills run but report missing tools, Codex has no usable Glean MCP
server in the current task:

1. Run `codex mcp list` and look for a `glean.com/mcp` URL.
2. If none is configured, run the setup above.
3. If it is configured but not authenticated, run
   `codex mcp login <friendly-name>`.
4. Start a new Codex task after configuration or authentication.

## Glean developer docs server (separate, optional)

The `glean-dev-docs` plugin uses a **different, public** server — no Glean
account or OAuth is required:

```bash
codex mcp add glean-dev-docs --url https://developers.glean.com/mcp
```

Start a new Codex task after adding it.

## Related skills

- **using-glean** — once connected, drives enterprise search, Q&A, and synthesis.
