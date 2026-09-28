#!/usr/bin/env node
// PreToolUse: carry request-local bypass context; only run_tool gets native approval.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!root || typeof input?.tool_name !== "string") process.exit(0);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin/plugin.json"), "utf8"));
  const cfg = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8"));
  if (typeof manifest.name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(manifest.name)) process.exit(0);

  for (const [server, config] of Object.entries(cfg.mcpServers ?? {})) {
    if (!/^[a-zA-Z0-9_-]+$/.test(server) || !config ||
        typeof config.command !== "string" || !config.command || config.url ||
        (config.type && config.type !== "stdio")) continue;
    const prefix = `mcp__plugin_${manifest.name}_${server}__`;
    if (!input.tool_name.startsWith(prefix)) continue;
    const bareName = input.tool_name.slice(prefix.length);
    if (!/^[a-zA-Z0-9_-]+$/.test(bareName)) continue;

    const validArgs = input.tool_input && typeof input.tool_input === "object" && !Array.isArray(input.tool_input);
    // Empty, not omitted: hosts may merge updatedInput with the original input.
    const updatedInput = { ...(validArgs ? input.tool_input : {}), _glean_permission_context: "" };
    const hitl = config.env?.ENABLE_HITL === "true";
    if (hitl && validArgs && input.permission_mode === "bypassPermissions") {
      try {
        const { createBypassReceipt } = await import(pathToFileURL(path.join(root, "mcp/approval-context.mjs")).href);
        const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), ".glean");
        updatedInput._glean_permission_context = createBypassReceipt(base, bareName, updatedInput);
      } catch { /* Empty context keeps the plugin's approval gate active. */ }
    }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput,
        ...(hitl && bareName === "run_tool" ? {
          permissionDecision: "allow",
          permissionDecisionReason: "Glean run_tool is gated by its own HITL elicitation prompt; suppressing the redundant native prompt while ENABLE_HITL is on.",
        } : {}),
      },
    }));
    break;
  }
} catch { /* Invalid hook input or plugin configuration: retain native permissions. */ }
