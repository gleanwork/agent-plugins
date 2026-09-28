import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Client } from "@modelcontextprotocol/client";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  acceptedContent, CLIENT_CAPABILITIES_META_KEY, createMcpHandler, inputRequired,
  McpServer, type CallToolResult, type InputRequiredResult, type ServerContext,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { createBypassReceipt, PERMISSION_CONTEXT_ARG as KEY } from "../approval-context.mjs";
import { callRemoteTool, createRemoteClient } from "../src/remote-client.js";
import { handleRunTool } from "../src/tools/run-tool.js";
import {
  remoteElicitationOptions, resolveToolApprovalContext, withPermissionContext,
} from "../src/write-approval.js";

const body = { body: "fake write only" };
const runArgs = { server_id: "test", tool_name: "fake_write", arguments: body };
const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] });
const errors = ["403 Forbidden", "401 [AUTHENTICATION_REQUIRED]"];
type Mode = "normal" | "off" | "bypass";
type ObservedCall = {
  name: string;
  args: Record<string, unknown>;
  capabilities: Record<string, unknown> | undefined;
  state: string | undefined;
  responses: Record<string, unknown> | undefined;
};

function makeHost() {
  return {
    getClientCapabilities: vi.fn(() => ({ elicitation: { form: {} } })),
    getClientVersion: vi.fn(() => ({ name: "claude-code", version: "1" })),
    elicitInput: vi.fn().mockResolvedValue({
      action: "accept", content: { approval: "Allow", approved: true },
    }),
    request: vi.fn().mockResolvedValue({}),
  };
}

describe("write approval boundary (in-memory modern MCP)", () => {
  let base: string;
  let host: ReturnType<typeof makeHost>;
  let handler: ReturnType<typeof createMcpHandler>;
  let clients: Client[];
  let calls: ObservedCall[];
  let writes: Record<string, unknown>[];
  const server = () => host as unknown as Server;
  const names = () => calls.map((call) => call.name);
  const withoutUpstreamForms = () => {
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.capabilities).toBeDefined();
      expect(call.capabilities).not.toHaveProperty("elicitation");
      expect(call.responses).toBeUndefined();
      expect(call.args).not.toHaveProperty(KEY);
    }
  };

  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), "write-approval-"));
    vi.stubEnv("CLAUDE_PLUGIN_DATA", base);
    vi.stubEnv("PLUGIN_DATA_DIR", base);
    vi.stubEnv("GLEAN_SESSION_ID", undefined);
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", undefined);
    vi.stubEnv("ENABLE_HITL", "true");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access"); }));
    host = makeHost();
    clients = [];
    calls = [];
    writes = [];
    function observe(name: string, args: Record<string, unknown>, ctx: ServerContext) {
      // Modern capabilities are per-request envelope metadata, not ctx.clientCapabilities.
      const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
      const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as Record<string, unknown> | undefined;
      calls.push({ name, args, capabilities, state: ctx.mcpReq.requestState<string>(),
        responses: ctx.mcpReq.inputResponses });
      return capabilities;
    }
    function execute(name: string, args: Record<string, unknown>, ctx: ServerContext): CallToolResult | InputRequiredResult {
      const capabilities = observe(name, args, ctx);
      const payload = name === "run_tool" ? args.arguments as Record<string, unknown> : args;
      if (errors.includes(String(payload.body))) return { ...text(String(payload.body)), isError: true };
      if (capabilities?.elicitation) {
        if (!ctx.mcpReq.inputResponses) {
          return inputRequired({
            inputRequests: { approval: inputRequired.elicit({
              message: "Remote approval",
              requestedSchema: { type: "object", properties: { approved: { type: "boolean" } }, required: ["approved"] },
            }) },
            requestState: "approval-state",
          });
        }
        if (!acceptedContent<{ approved: boolean }>(ctx.mcpReq.inputResponses, "approval")?.approved) {
          return { ...text("Remote approval declined"), isError: true };
        }
      }
      writes.push(payload);
      return text("executed");
    }
    handler = createMcpHandler(() => {
      const remote = new McpServer({ name: "approval-test", version: "1" });
      const identity = { server_id: z.string(), tool_name: z.string() };
      remote.registerTool("get_tool_approval", { inputSchema: z.strictObject(identity) }, async (args, ctx) => {
        observe("get_tool_approval", args, ctx);
        return text(JSON.stringify({ requires_approval: true }));
      });
      remote.registerTool("set_tool_approval", {
        inputSchema: z.strictObject({ ...identity, value: z.literal("ALWAYS_ALLOWED") }),
      }, async (args, ctx) => {
        observe("set_tool_approval", args, ctx);
        return text("saved in fake backend only");
      });
      const payload = z.strictObject({ body: z.string() });
      remote.registerTool("run_tool", {
        inputSchema: z.strictObject({ ...identity, arguments: payload }),
      }, async (args, ctx) => execute("run_tool", args, ctx));
      remote.registerTool("memory", { inputSchema: payload }, async (args, ctx) => execute("memory", args, ctx));
      return remote;
    });
  });

  afterEach(async () => {
    try {
      await Promise.all(clients.map((client) => client.close()));
      await handler.close();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      await fs.rm(base, { recursive: true, force: true });
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  function inputFor(mode: Mode, name = "run_tool", args: Record<string, unknown> = runArgs) {
    vi.stubEnv("ENABLE_HITL", mode === "off" ? "false" : "true");
    return { ...args, [KEY]: mode === "bypass" ? createBypassReceipt(base, name, args) : "invalid-context" };
  }

  // Compose the exported boundaries without importing index.ts and starting stdio/OAuth.
  async function dispatch(name: string, input: Record<string, unknown>, fileArgs = true) {
    const { args, approvalEnabled } = resolveToolApprovalContext(name, input);
    const remote = await createRemoteClient("http://approval.test/mcp", {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
      // run_tool owns one LOCAL gate; only promoted tools forward upstream forms.
      ...remoteElicitationOptions(server(), name === "run_tool" ? false : approvalEnabled),
    });
    clients.push(remote);
    expect(remote.getProtocolEra()).toBe("modern");
    return name === "run_tool"
      ? handleRunTool(remote, server(), base, args, { fileArgs, approvalEnabled })
      : callRemoteTool(remote, name, args);
  }

  it.each(["off", "bypass"] as const)("%s executes without forms or preference reads/writes, even with no session ID", async (mode) => {
    const input = Object.freeze(inputFor(mode));
    expect(process.env.GLEAN_SESSION_ID).toBeUndefined();
    expect(process.env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    expect(host.getClientCapabilities()).toHaveProperty("elicitation.form");
    const result = await dispatch("run_tool", input);
    expect(result.content).toEqual(text("executed").content);
    expect(result.isError).not.toBe(true);
    expect(names()).toEqual(["run_tool"]);
    expect(calls[0].args).toEqual(runArgs);
    expect(input).toHaveProperty(KEY);
    expect(writes).toEqual([body]);
    expect(host.elicitInput).not.toHaveBeenCalled();
    withoutUpstreamForms();
  });

  it.each(["Allow", "Deny", "Always Allow"])("normal %s uses exactly one local prompt, never a second upstream gate", async (choice) => {
    host.elicitInput.mockResolvedValue({ action: "accept", content: { approval: choice } });
    const result = await dispatch("run_tool", inputFor("normal"));
    expect(host.elicitInput).toHaveBeenCalledTimes(1);
    expect(host.elicitInput.mock.calls[0][0]).toMatchObject({ mode: "form" });
    expect(names()).toEqual(choice === "Deny" ? ["get_tool_approval"]
      : choice === "Always Allow" ? ["get_tool_approval", "set_tool_approval", "run_tool"]
      : ["get_tool_approval", "run_tool"]);
    expect(writes).toEqual(choice === "Deny" ? [] : [body]);
    expect(JSON.stringify(result)).toContain(choice === "Deny" ? "declined" : "executed");
    if (choice === "Always Allow") expect(calls[1].args).toEqual({
      server_id: "test", tool_name: "fake_write", value: "ALWAYS_ALLOWED",
    });
    withoutUpstreamForms();
  });

  it("resolves each call afresh across mode changes, new receipts, replays, and sessions", async () => {
    const first = inputFor("bypass");
    await dispatch("run_tool", first);
    expect(host.elicitInput).not.toHaveBeenCalled();
    vi.stubEnv("GLEAN_SESSION_ID", "session-two");
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", "claude-two");
    await dispatch("run_tool", runArgs);
    await dispatch("run_tool", first); // A consumed receipt cannot authorize another call/session.
    expect(host.elicitInput).toHaveBeenCalledTimes(2);
    const second = inputFor("bypass");
    expect(second[KEY]).not.toBe(first[KEY]);
    await dispatch("run_tool", second);
    await dispatch("run_tool", inputFor("off"));
    expect(host.elicitInput).toHaveBeenCalledTimes(2);
    await dispatch("run_tool", inputFor("normal"));
    vi.stubEnv("GLEAN_SESSION_ID", undefined);
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", undefined);
    await dispatch("run_tool", runArgs);
    expect(host.elicitInput).toHaveBeenCalledTimes(4);
    expect(names().filter((name) => name === "get_tool_approval")).toHaveLength(4);
    expect(names()).not.toContain("set_tool_approval");
    expect(writes).toHaveLength(7);
    withoutUpstreamForms();
  });

  it.each([undefined, "bypassPermissions", { permission_mode: "bypassPermissions" }, "00000000-0000-4000-8000-000000000000"])(
    "invalid context %j stays in normal approval mode", async (context) => {
      host.elicitInput.mockResolvedValue({ action: "accept", content: { approval: "Deny" } });
      const input = Object.freeze({ ...runArgs, [KEY]: context });
      expect(resolveToolApprovalContext("run_tool", input)).toEqual({ args: runArgs, approvalEnabled: true });
      await dispatch("run_tool", input);
      expect(names()).toEqual(["get_tool_approval"]);
      expect(host.elicitInput).toHaveBeenCalledTimes(1);
      expect(writes).toEqual([]);
      expect(input[KEY]).toEqual(context);
      withoutUpstreamForms();
    },
  );

  it.each(["normal", "off", "bypass"] as const)("promoted tool forwards forms only when enabled: %s", async (mode) => {
    const input = inputFor(mode, "memory", body);
    const result = await dispatch("memory", input);
    expect(result.content).toEqual(text("executed").content);
    expect(result.isError).not.toBe(true);
    expect(host.elicitInput).toHaveBeenCalledTimes(mode === "normal" ? 1 : 0);
    expect(names()).toEqual(mode === "normal" ? ["memory", "memory"] : ["memory"]);
    expect(calls.every((call) => JSON.stringify(call.args) === JSON.stringify(body))).toBe(true);
    expect(writes).toEqual([body]);
    if (mode === "normal") {
      expect(calls[0].capabilities).toHaveProperty("elicitation");
      expect(calls.map((call) => call.state)).toEqual([undefined, "approval-state"]);
      expect(calls[1].responses).toMatchObject({ approval: { action: "accept", content: { approved: true } } });
      expect(host.elicitInput.mock.calls[0][0]).toMatchObject({ message: "Remote approval" });
    } else withoutUpstreamForms();
  });

  it.each(["off", "bypass"] as const)("%s preserves forbidden/auth errors, without auto-accepting or retrying", async (mode) => {
    for (const error of errors) for (const name of ["run_tool", "memory"]) {
      const payload = { body: error };
      const args = name === "run_tool" ? { ...runArgs, arguments: payload } : payload;
      expect(await dispatch(name, inputFor(mode, name, args))).toMatchObject({ ...text(error), isError: true });
    }
    expect(names()).toEqual(["run_tool", "memory", "run_tool", "memory"]);
    expect(writes).toEqual([]);
    expect(host.elicitInput).not.toHaveBeenCalled();
    withoutUpstreamForms();
  });

  it.each([
    { fileArgs: false, extra: { file_args: { body: "/never-read" } }, message: "`file_args` is disabled" },
    { fileArgs: true, extra: { file_args: { body: "relative-path" } }, message: "absolute" },
    { fileArgs: true, extra: { server_id: null }, message: "required strings" },
  ])("disabled approval preserves the $message guard", async ({ fileArgs, extra, message }) => {
    const result = await dispatch("run_tool", inputFor("off", "run_tool", { ...runArgs, ...extra }), fileArgs);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain(message);
    expect(calls).toEqual([]);
    expect(writes).toEqual([]);
    expect(host.elicitInput).not.toHaveBeenCalled();
  });

  it("adds optional context to closed schemas without mutating the original tool", () => {
    const tool: Tool = { name: "memory", inputSchema: {
      type: "object", properties: { body: { type: "string" } }, required: ["body"], additionalProperties: false,
    } };
    const original = structuredClone(tool);
    const augmented = withPermissionContext(tool);
    expect(tool).toEqual(original);
    expect(augmented).not.toBe(tool);
    expect(augmented.inputSchema).not.toBe(tool.inputSchema);
    expect(augmented.inputSchema.properties).not.toBe(tool.inputSchema.properties);
    expect(augmented.inputSchema.additionalProperties).toBe(false);
    expect(augmented.inputSchema.required).toEqual(["body"]);
    expect(augmented.inputSchema.properties).toEqual({ ...tool.inputSchema.properties,
      [KEY]: { type: "string", description: expect.any(String) },
    });
  });

  it("does not advertise upstream forms when the host has no elicitation support", () => {
    host.getClientCapabilities.mockReturnValue({} as ReturnType<typeof host.getClientCapabilities>);
    expect(remoteElicitationOptions(server(), true)).toEqual({});
  });
});
