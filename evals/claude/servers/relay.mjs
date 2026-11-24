#!/usr/bin/env node
// Runs a published Glean plugin's local relay (mcp/start.mjs) against the stub
// Glean server, over stdio. This is the server a Claude Code user of the
// plugin has today.
//
//   node relay.mjs --plugin <path to the plugin's directory> [--first-run]
//
// The relay needs a saved server URL and a token before it forwards a call, so
// this writes both into a temporary data directory. The stub accepts any
// token. With --first-run it writes neither: the relay is in the state a user
// meets straight after they install the plugin.
//
// The relay's approval prompt is left off (ENABLE_HITL is unset): these evals
// call read-only tools and do not measure approval.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { serveHttp } from "./glean-stub.mjs";

const pluginDir = process.argv[process.argv.indexOf("--plugin") + 1];
const start = pluginDir && path.join(pluginDir, "mcp", "start.mjs");
if (!start || !fs.existsSync(start)) {
  console.error("usage: relay.mjs --plugin <plugin directory with mcp/start.mjs>");
  process.exit(2);
}

const { server, url } = await serveHttp("gateway");
// The stub must not keep the process alive after the client disconnects.
server.unref();
process.stdin.on("close", () => process.exit(0));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "glean-relay-eval-"));
process.on("exit", () => fs.rmSync(dataDir, { recursive: true, force: true }));

if (!process.argv.includes("--first-run")) {
  fs.writeFileSync(
    path.join(dataDir, "mcp-server-url.json"),
    JSON.stringify({ serverUrl: `${url}/mcp/gateway/proxy` }),
  );
  fs.writeFileSync(
    path.join(dataDir, "mcp-credentials.json"),
    JSON.stringify({ tokens: { access_token: "stub-token", token_type: "Bearer" } }),
  );
}

process.env.CLAUDE_PLUGIN_DATA = dataDir;
delete process.env.GLEAN_MCP_SERVER_URL;
delete process.env.ENABLE_HITL;

await import(pathToFileURL(start).href);
