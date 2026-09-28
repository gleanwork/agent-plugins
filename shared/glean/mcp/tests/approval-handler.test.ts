import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UnauthorizedError } from "@modelcontextprotocol/client";
import type { CallToolRequest, CallToolResult, ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import {
  acceptedContent, CLIENT_CAPABILITIES_META_KEY, createMcpHandler, inputRequired,
  McpServer, type ServerContext,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// Only the host transport and authentication are fake. index.ts registers the
// handlers; its dispatch, remote client, approval policy and receipt reader run unchanged.
const mocks = vi.hoisted(() => {
  const handlers = new Map<string, unknown>();
  return {
    handlers, home: "",
    host: {
      setRequestHandler: vi.fn((schema, handler) => handlers.set(schema.shape.method.value, handler)),
      connect: vi.fn(async () => {}), request: vi.fn(async () => ({})),
      getClientCapabilities: vi.fn(() => ({ elicitation: { form: {} } })),
      getClientVersion: vi.fn(() => ({ name: "claude-code", version: "1" })),
      elicitInput: vi.fn(), sendToolListChanged: vi.fn(async () => {}),
    },
    openBrowser: vi.fn(), setPendingAuthCode: vi.fn(),
    startCallbackServer: vi.fn(async () => ({ code: Promise.resolve("local-test-code") })),
    closeCallbackServer: vi.fn(),
  };
});
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({ Server: class {
  constructor() { return mocks.host; }
} }));
vi.mock("node:os", async (original) => {
  const actual = await original<typeof import("node:os")>();
  return { ...actual, homedir: () => mocks.home,
    default: { ...actual, homedir: () => mocks.home } };
});
vi.mock("../src/auth-provider.js", () => ({
  GleanOAuthClientProvider: class {
    authorizationUrl = "https://approval.invalid/local-sign-in";
    tokens() { return { access_token: "local-test-token", token_type: "Bearer" }; }
    clientInformation() { return { client_id: "local-test-client" }; }
    needsFreshClient() { return false; }
    // Complete simulated sign-in immediately; never perform a token exchange.
    setPendingAuthCode = mocks.setPendingAuthCode;
  },
  openBrowser: mocks.openBrowser,
}));
vi.mock("../src/auth-callback-server.js", () => ({
  startCallbackServer: mocks.startCallbackServer, closeCallbackServer: mocks.closeCallbackServer,
}));

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const endpoint = "https://approval.invalid/mcp/gateway/proxy";
const KEY = "_glean_permission_context";
const body = { body: "local fake write" };
const runArgs = { server_id: "fake", tool_name: "fake_write", arguments: body };
const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
type Mode = "normal" | "off" | "bypass";
type Config = { mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> };
type Seen = { name: string; args: Record<string, unknown>; capabilities: unknown;
  state: unknown; responses: unknown };
let buildDir: string, plugin: string, config: Config, serverName: string, namespace: string, hook: string;
let hookMatcher: RegExp;
let root: string, backend: ReturnType<typeof createMcpHandler>;
let calls: Seen[], writes: Record<string, unknown>[], denied: string[];
let wire: { method: string; capabilities: unknown }[];
let authFailures: number, changeHitlAfterFailure: string | undefined;

beforeAll(() => {
  // CI runs test:bundle before build. Build from source, privately: version.test.ts
  // also writes the repository bundle, and prebuild syncs tracked changelogs.
  buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "approval-package-"));
  for (const entry of ["package.json", "pluginpack.config.ts", "CHANGELOG.md", "LICENSE", "scripts", "shared", "overrides"]) {
    fs.cpSync(path.join(repo, entry), path.join(buildDir, entry), { recursive: true,
      filter: (source) => !["dist", "node_modules", "tests"].includes(path.basename(source)) });
  }
  fs.symlinkSync(path.join(repo, "node_modules"), path.join(buildDir, "node_modules"), "dir");
  const buildHome = path.join(buildDir, "home");
  fs.mkdirSync(buildHome);
  const logPath = path.join(buildDir, "build.log");
  const log = fs.openSync(logPath, "w");
  try {
    execFileSync("npm", ["run", "build"], { cwd: buildDir, timeout: 60_000,
      env: { ...process.env, HOME: buildHome, USERPROFILE: buildHome,
        npm_config_offline: "true", npm_config_audit: "false" }, stdio: ["ignore", log, log] });
  } catch (error) {
    throw new Error(`${String(error)}\n${fs.readFileSync(logPath, "utf8").slice(-6000)}`);
  } finally { fs.closeSync(log); }
  plugin = path.join(buildDir, "dist/claude/plugins/glean");
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, ".claude-plugin/plugin.json"), "utf8"));
  config = JSON.parse(fs.readFileSync(path.join(plugin, ".mcp.json"), "utf8"));
  expect(Object.keys(config.mcpServers)).toHaveLength(1);
  [serverName] = Object.keys(config.mcpServers);
  expect(config.mcpServers[serverName].env.ENABLE_HITL).toBe("true");
  namespace = `mcp__plugin_${manifest.name}_${serverName}__`;
  const hooks = JSON.parse(fs.readFileSync(path.join(plugin, manifest.hooks ?? "hooks/hooks.json"), "utf8"));
  const matched = hooks.hooks.PreToolUse.filter((entry: { matcher: string }) =>
    new RegExp(entry.matcher).test(`${namespace}run_tool`));
  expect(matched).toHaveLength(1);
  hookMatcher = new RegExp(matched[0].matcher);
  expect(matched[0].hooks).toHaveLength(1);
  expect(matched[0].hooks[0].type).toBe("command");
  const command = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/([^\"]+)"$/.exec(matched[0].hooks[0].command);
  expect(command).not.toBeNull();
  hook = path.join(plugin, command![1]);
  for (const file of [hook, path.join(plugin, "mcp/approval-context.mjs"), path.join(plugin, "mcp/dist/index.js")]) {
    expect(fs.statSync(file).size).toBeGreaterThan(0);
  }
}, 90_000);
afterAll(() => { if (buildDir) fs.rmSync(buildDir, { recursive: true, force: true }); });

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.handlers.clear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "approval-handlers-"));
  mocks.home = path.join(root, "home");
  fs.mkdirSync(mocks.home);
  for (const [key, value] of Object.entries({
    HOME: mocks.home, USERPROFILE: mocks.home, GLEAN_MCP_SERVER_URL: endpoint,
    PLUGIN_DATA_DIR: path.join(root, "server-data"), CLAUDE_PLUGIN_DATA: path.join(root, "host-data"),
    SKILLS_BASE_DIR: path.join(root, "skills"), GLEAN_SESSION_ID: undefined,
    CLAUDE_CODE_SESSION_ID: undefined, ENABLE_HITL: "true", GLEAN_REMOTE_TOOL_TIMEOUT_MS: "2000",
  })) vi.stubEnv(key, value);
  calls = []; writes = []; denied = []; wire = []; authFailures = 0; changeHitlAfterFailure = undefined;
  mocks.host.elicitInput.mockResolvedValue({ action: "accept", content: { approval: "Allow", approved: true } });
  vi.spyOn(console, "error").mockImplementation(() => {});
  function observe(name: string, args: Record<string, unknown>, ctx: ServerContext) {
    const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
    const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as Record<string, unknown> | undefined;
    calls.push({ name, args, capabilities, state: ctx.mcpReq.requestState(), responses: ctx.mcpReq.inputResponses });
    return capabilities;
  }
  function execute(name: string, args: Record<string, unknown>, ctx: ServerContext) {
    const capabilities = observe(name, args, ctx);
    if (capabilities?.elicitation) {
      if (!ctx.mcpReq.inputResponses) return inputRequired({
        inputRequests: { approval: inputRequired.elicit({ message: "Upstream approval",
          requestedSchema: { type: "object", properties: { approved: { type: "boolean" } }, required: ["approved"] } }) },
        requestState: "pending-write",
      });
      if (!acceptedContent<{ approved: boolean }>(ctx.mcpReq.inputResponses, "approval")?.approved) {
        return { ...text("declined"), isError: true };
      }
    }
    writes.push(name === "run_tool" ? args.arguments as Record<string, unknown> : args);
    return text("executed");
  }
  backend = createMcpHandler(() => {
    const remote = new McpServer({ name: "approval-handler-fixture", version: "1" });
    const identity = { server_id: z.string(), tool_name: z.string() };
    remote.registerTool("get_tool_approval", { inputSchema: z.strictObject(identity) }, async (args, ctx) => {
      observe("get_tool_approval", args, ctx); return text('{"requires_approval":true}');
    });
    remote.registerTool("set_tool_approval", {
      inputSchema: z.strictObject({ ...identity, value: z.literal("ALWAYS_ALLOWED") }),
    }, async (args, ctx) => { observe("set_tool_approval", args, ctx); return text("saved locally"); });
    const payload = z.strictObject({ body: z.string() });
    remote.registerTool("run_tool", { inputSchema: z.strictObject({ ...identity, arguments: payload }) },
      async (args, ctx) => execute("run_tool", args, ctx));
    remote.registerTool("memory", { inputSchema: payload }, async (args, ctx) => execute("memory", args, ctx));
    return remote;
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url !== endpoint) { denied.push(request.url); throw new Error(`Network forbidden: ${request.url}`); }
    if (request.method === "POST") {
      const frame = await request.clone().json();
      wire.push({ method: frame.method, capabilities: frame.params?._meta?.[CLIENT_CAPABILITIES_META_KEY] });
      if (frame.method === "server/discover" && authFailures > 0) {
        authFailures -= 1;
        if (changeHitlAfterFailure) vi.stubEnv("ENABLE_HITL", changeHitlAfterFailure);
        throw new UnauthorizedError("Simulated expired token; no real OAuth");
      }
    }
    return backend.fetch(request);
  }));
  await import("../src/index.js");
  await vi.waitFor(() => expect(mocks.host.connect).toHaveBeenCalledTimes(1));
  expect([...mocks.handlers.keys()].sort()).toEqual(["tools/call", "tools/list"]);
});
afterEach(async () => {
  try {
    await backend?.close();
    expect(denied).toEqual([]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  }
});

// No copied dispatch: invoke the functions captured from the real SDK registration.
function call(name: string, args: Record<string, unknown> = {}) {
  const handler = mocks.handlers.get("tools/call") as (request: CallToolRequest) => Promise<CallToolResult>;
  return handler({ method: "tools/call", params: { name, arguments: args } });
}
function fromHook(mode: Mode, name = "run_tool", args: Record<string, unknown> = runArgs) {
  const cfg = structuredClone(config);
  const hitl = mode === "off" ? "false" : "true";
  cfg.mcpServers[serverName].env.ENABLE_HITL = hitl;
  fs.writeFileSync(path.join(plugin, ".mcp.json"), JSON.stringify(cfg));
  vi.stubEnv("ENABLE_HITL", hitl);
  expect(hookMatcher.test(`${namespace}${name}`)).toBe(true);
  const output = execFileSync(process.execPath, [hook], { timeout: 5000, encoding: "utf8",
    cwd: root, env: { ...process.env, CLAUDE_PLUGIN_ROOT: plugin },
    input: JSON.stringify({ tool_name: `${namespace}${name}`, tool_input: args,
      permission_mode: mode === "bypass" ? "bypassPermissions" : "default" }) });
  const result = JSON.parse(output).hookSpecificOutput;
  expect(result.hookEventName).toBe("PreToolUse");
  expect(result.permissionDecision).toBe(mode !== "off" && name === "run_tool" ? "allow" : undefined);
  expect(result.updatedInput[KEY]).toEqual(mode === "bypass" ? expect.stringMatching(/.+/) : "");
  return result.updatedInput as Record<string, unknown>;
}
const names = () => calls.map(({ name }) => name);
function noForms() {
  expect(calls.length).toBeGreaterThan(0);
  for (const seen of calls) {
    expect(seen.capabilities).toBeDefined();
    expect(seen.capabilities).not.toHaveProperty("elicitation");
    expect(seen.responses).toBeUndefined();
    expect(seen.args).not.toHaveProperty(KEY);
  }
}

describe("registered approval handlers with the packaged Claude hook", () => {
  it("advertises optional internal context, including a closed promoted schema", async () => {
    const list = mocks.handlers.get("tools/list") as () => Promise<ListToolsResult>;
    const { tools } = await list();
    expect(tools.map(({ name }) => name)).toEqual(expect.arrayContaining(["setup", "run_tool", "memory"]));
    for (const tool of tools) {
      expect(tool.inputSchema.properties?.[KEY]).toMatchObject({ type: "string" });
      expect(tool.inputSchema.required ?? []).not.toContain(KEY);
    }
    expect(tools.find(({ name }) => name === "memory")?.inputSchema).toMatchObject({
      additionalProperties: false, required: ["body"], properties: { body: { type: "string" } },
    });
    expect(wire.map(({ method }) => method)).toEqual(["server/discover", "tools/list"]);
  });

  it.each(["off", "bypass"] as const)("%s skips preference reads/writes and forms without session IDs", async (mode) => {
    expect(process.env.GLEAN_SESSION_ID).toBeUndefined();
    expect(process.env.CLAUDE_CODE_SESSION_ID).toBeUndefined();
    const input = Object.freeze(fromHook(mode));
    expect(await call("run_tool", input)).toMatchObject(text("executed"));
    expect(names()).toEqual(["run_tool"]);
    expect(calls[0].args).toEqual(runArgs);
    expect(writes).toEqual([body]);
    expect(mocks.host.elicitInput).not.toHaveBeenCalled();
    expect(mocks.openBrowser).not.toHaveBeenCalled();
    noForms();
  });

  it.each(["Allow", "Deny", "Always Allow"])("normal %s prompts once with no upstream gate", async (choice) => {
    mocks.host.elicitInput.mockResolvedValue({ action: "accept", content: { approval: choice } });
    const result = await call("run_tool", fromHook("normal"));
    expect(mocks.host.elicitInput).toHaveBeenCalledTimes(1);
    expect(mocks.host.elicitInput.mock.calls[0][0]).toMatchObject({ mode: "form" });
    expect(names()).toEqual(choice === "Deny" ? ["get_tool_approval"] : choice === "Always Allow"
      ? ["get_tool_approval", "set_tool_approval", "run_tool"] : ["get_tool_approval", "run_tool"]);
    expect(writes).toEqual(choice === "Deny" ? [] : [body]);
    expect(JSON.stringify(result)).toContain(choice === "Deny" ? "declined" : "executed");
    if (choice === "Always Allow") expect(calls[1].args).toEqual({
      server_id: "fake", tool_name: "fake_write", value: "ALWAYS_ALLOWED",
    });
    noForms();
  });

  it("restores normal gating after bypass/off and strips replayed or forged context", async () => {
    const bypass = fromHook("bypass");
    await call("run_tool", bypass);
    await call("run_tool", fromHook("off"));
    mocks.host.elicitInput.mockResolvedValue({ action: "accept", content: { approval: "Deny" } });
    await call("run_tool", fromHook("normal", "run_tool", bypass));
    await call("run_tool", bypass); // One-use receipt cannot authorize a replay.
    await call("run_tool", { ...runArgs, [KEY]: "forged" });
    expect(names()).toEqual(["run_tool", "run_tool", "get_tool_approval", "get_tool_approval", "get_tool_approval"]);
    expect(mocks.host.elicitInput).toHaveBeenCalledTimes(3);
    expect(writes).toEqual([body, body]);
    noForms();
  });

  it.each(["normal", "off", "bypass"] as const)("promoted memory forwards forms only in normal mode: %s", async (mode) => {
    expect(await call("memory", fromHook(mode, "memory", body))).toMatchObject(text("executed"));
    expect(names()).toEqual(mode === "normal" ? ["memory", "memory"] : ["memory"]);
    expect(calls.every(({ args }) => JSON.stringify(args) === JSON.stringify(body))).toBe(true);
    expect(writes).toEqual([body]);
    expect(mocks.host.elicitInput).toHaveBeenCalledTimes(mode === "normal" ? 1 : 0);
    if (mode === "normal") {
      expect(calls[0].capabilities).toHaveProperty("elicitation");
      expect(calls.map(({ state }) => state)).toEqual([undefined, "pending-write"]);
      expect(calls[1].responses).toMatchObject({ approval: { action: "accept", content: { approved: true } } });
    } else noForms();
  });

  it("shares ~/.glean with the hook when only PLUGIN_DATA_DIR is set", async () => {
    vi.stubEnv("CLAUDE_PLUGIN_DATA", undefined);
    const input = fromHook("bypass");
    const receipts = path.join(mocks.home, ".glean/glean-bypass-receipts");
    expect(fs.readdirSync(receipts)).toHaveLength(1);
    expect(fs.existsSync(path.join(process.env.PLUGIN_DATA_DIR!, "glean-bypass-receipts"))).toBe(false);
    expect(await call("run_tool", input)).toMatchObject(text("executed"));
    expect(fs.readdirSync(receipts)).toHaveLength(0);
    expect(names()).toEqual(["run_tool"]);
    expect(mocks.host.elicitInput).not.toHaveBeenCalled();
    noForms();
  });

  it.each(["normal", "off", "bypass"] as const)("setup retains %s approval policy through all reconnects", async (mode) => {
    const input = fromHook(mode, "setup", {});
    authFailures = 2; // Authenticated attempt, then callback-listener attempt, then post-sign-in reconnect.
    changeHitlAfterFailure = mode === "normal" ? "false" : "true";
    expect(JSON.stringify(await call("setup", input))).toContain("Glean setup is complete");
    expect(wire.map(({ method }) => method)).toEqual([
      "server/discover", "server/discover", "server/discover", "tools/list",
    ]);
    for (const request of wire) {
      expect(request.capabilities).toBeDefined();
      if (mode === "normal") expect(request.capabilities).toHaveProperty("elicitation");
      else expect(request.capabilities).not.toHaveProperty("elicitation");
    }
    expect(mocks.startCallbackServer).toHaveBeenCalledTimes(1);
    expect(mocks.closeCallbackServer).toHaveBeenCalledTimes(1);
    expect(mocks.openBrowser).toHaveBeenCalledExactlyOnceWith("https://approval.invalid/local-sign-in");
    expect(mocks.setPendingAuthCode).toHaveBeenCalledExactlyOnceWith("local-test-code");
    expect(mocks.host.elicitInput).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(writes).toEqual([]);
  });
});
