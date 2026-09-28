import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { PERMISSION_CONTEXT_ARG as KEY, createBypassReceipt, consumeBypassReceipt } from "../approval-context.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(here, "../../../../overrides/claude/glean/hooks/auto-approve-run-tool.mjs");
const glean = (tool: string) => `mcp__plugin_local-mcp_glean_plugin__${tool}`;
const args = { server_id: "server", tool_name: "send_message", arguments: { body: "private body" } };
let root: string, dataDir: string;
function configure(hitl = "true", server = "glean_plugin", extra = {}) {
  fs.writeFileSync(path.join(root, ".mcp.json"), JSON.stringify({
    mcpServers: { [server]: { command: "node", env: { ENABLE_HITL: hitl }, ...extra } },
  }));
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "approve-hook-"));
  dataDir = path.join(root, "plugin-data");
  fs.mkdirSync(path.join(root, ".claude-plugin"));
  fs.writeFileSync(path.join(root, ".claude-plugin/plugin.json"), JSON.stringify({ name: "local-mcp" }));
  fs.mkdirSync(path.join(root, "mcp"));
  fs.copyFileSync(path.resolve(here, "../approval-context.mjs"), path.join(root, "mcp/approval-context.mjs"));
  configure();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function runHook(tool = glean("run_tool"), extra: Record<string, unknown> = {}, raw?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: dataDir };
  delete env.CLAUDE_CODE_SESSION_ID;
  const out = execFileSync(process.execPath, [HOOK], {
    env, encoding: "utf8", input: raw ?? JSON.stringify({ tool_name: tool, tool_input: args, ...extra }),
  });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}
const bypass = { permission_mode: "bypassPermissions" };

describe("request-local approval hook", () => {
  it("creates a usable receipt without any host session id", () => {
    const result = runHook(glean("run_tool"), bypass);
    expect(result.permissionDecision).toBe("allow");
    expect(result.hookEventName).toBe("PreToolUse");
    expect(consumeBypassReceipt(dataDir, result.updatedInput[KEY], "run_tool", args)).toBe(true);
    expect(fs.readdirSync(dataDir)).toEqual(["glean-bypass-receipts"]);
  });
  it.each([undefined, null, "", "default", "acceptEdits", "plan", "dontAsk", "bypasspermissions", {}, true])(
    "sanitizes forged context for absent, normal, or invalid mode %j", (permission_mode) => {
      const result = runHook(glean("run_tool"), { permission_mode, tool_input: { ...args, [KEY]: "forged" } });
      expect(result.updatedInput).toEqual({ ...args, [KEY]: "" });
      expect(result.permissionDecision).toBe("allow");
      expect(fs.existsSync(dataDir)).toBe(false);
    },
  );
  it.each(["resumed-session", "other-session"])("sanitizes a valid token in normal %s", (session_id) => {
    const token = createBypassReceipt(dataDir, "run_tool", args);
    const result = runHook(glean("run_tool"), {
      permission_mode: "default", session_id, tool_input: { ...args, [KEY]: token },
    });
    expect(result.updatedInput[KEY]).toBe("");
    expect(consumeBypassReceipt(dataDir, result.updatedInput[KEY], "run_tool", args)).toBe(false);
  });
  it("replaces supplied context even in bypass mode", () => {
    const token = createBypassReceipt(dataDir, "run_tool", args);
    const result = runHook(glean("run_tool"), { ...bypass, tool_input: { ...args, [KEY]: token } });
    expect(result.updatedInput[KEY]).not.toBe(token);
    expect(consumeBypassReceipt(dataDir, result.updatedInput[KEY], "run_tool", args)).toBe(true);
  });
  it.each(["find_skills_and_tools", "read_document"])("hands off bypass for %s without native approval", (tool) => {
    const result = runHook(glean(tool), bypass);
    expect(result.permissionDecision).toBeUndefined();
    expect(consumeBypassReceipt(dataDir, result.updatedInput[KEY], tool, args)).toBe(true);
  });
  it.each(["run_tool", "find_skills_and_tools"])("neither approves nor writes a receipt for HITL-off %s", (tool) => {
    configure("false");
    const result = runHook(glean(tool), { ...bypass, tool_input: { ...args, [KEY]: "forged" } });
    expect(result.updatedInput[KEY]).toBe("");
    expect(result.permissionDecision).toBeUndefined();
    expect(fs.existsSync(dataDir)).toBe(false);
  });
  it.each(["mcp__glean_default__run_tool", "mcp__plugin_other_glean_plugin__run_tool",
    "mcp__plugin_local-mcp_glean_plugin_other__run_tool", "mcp__other-server__run_tool"])(
    "ignores unrelated server %s", (tool) => {
      expect(runHook(tool, bypass)).toBeNull();
      expect(fs.existsSync(dataDir)).toBe(false);
    },
  );
  it("derives both namespace components from trusted configuration", () => {
    fs.writeFileSync(path.join(root, ".claude-plugin/plugin.json"), '{"name":"renamed-plugin"}');
    configure("true", "local-server");
    expect(runHook("mcp__plugin_renamed-plugin_local-server__run_tool").permissionDecision).toBe("allow");
    expect(runHook()).toBeNull();
  });
  it("does not approve a remote server configured in the plugin", () => {
    configure("true", "glean_plugin", { type: "http", url: "https://example.test/mcp" });
    expect(runHook()).toBeNull();
  });
  it("requires the plugin manifest", () => {
    fs.unlinkSync(path.join(root, ".claude-plugin/plugin.json"));
    expect(runHook(glean("run_tool"), bypass)).toBeNull();
  });
  it.each(["unwritable", "missing-helper"])("fails toward the gate when %s", (failure) => {
    if (failure === "unwritable") fs.writeFileSync(dataDir, "blocked");
    else fs.unlinkSync(path.join(root, "mcp/approval-context.mjs"));
    expect(runHook(glean("run_tool"), bypass).updatedInput[KEY]).toBe("");
  });
  it("ignores malformed JSON", () => expect(runHook(undefined, {}, "{")).toBeNull());
  it("matches all plugin tools but not non-plugin tools", () => {
    const config = JSON.parse(fs.readFileSync(path.join(path.dirname(HOOK), "hooks.json"), "utf8"));
    const matcher = new RegExp(config.hooks.PreToolUse[0].matcher);
    expect(matcher.test(glean("find_skills_and_tools"))).toBe(true);
    expect(matcher.test("mcp__glean_default__run_tool")).toBe(false);
  });
});
