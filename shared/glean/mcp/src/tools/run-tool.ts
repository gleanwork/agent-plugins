import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { EmptyResultSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { callRemoteTool } from "../remote-client.js";
import { FILE_ARGS_DISABLED_TEXT } from "../policy/enforce.js";
import { resolveSessionId } from "../session-id.js";
import { hostSharedDataDir } from "../data-dir.js";

const DEFAULT_FILE_ARG_MAX_BYTES = 5 * 1024 * 1024;

// How long a user has to respond to an approval prompt. The MCP SDK's own
// request timeout is 60s and, on expiry, elicitInput REJECTS — so unless we
// pass an explicit (longer) value the prompt errors out from under the user.
const defaultHitlTimeoutMs = 300_000;

export class FileArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileArgsError";
  }
}

// A downstream tool parameter's JSON Schema, narrowed to the bits we use.
// `type` may be a single string or an array (e.g. ["object", "null"]).
interface ParamSchema {
  type?: string | string[];
}
interface ToolInputSchema {
  properties?: Record<string, ParamSchema>;
}

// The set of JSON Schema types declared for a top-level parameter. file_args
// keys always map to top-level argument names, so a direct properties lookup
// is sufficient — no need to walk nested schemas.
function declaredParamTypes(
  inputSchema: ToolInputSchema | undefined,
  argName: string,
): Set<string> {
  const t = inputSchema?.properties?.[argName]?.type;
  if (typeof t === "string") return new Set([t]);
  if (Array.isArray(t)) {
    return new Set(t.filter((x): x is string => typeof x === "string"));
  }
  return new Set();
}

function fileArgsMaxBytes(): number {
  const raw = process.env.GLEAN_FILE_ARG_MAX_BYTES;
  if (!raw) return DEFAULT_FILE_ARG_MAX_BYTES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_FILE_ARG_MAX_BYTES;
}

function hitlTimeoutMs(): number {
  const raw = process.env.HITL_TIMEOUT_MS;
  if (!raw) return defaultHitlTimeoutMs;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultHitlTimeoutMs;
}

/**
 * Reads each `file_args` entry from disk and merges its content into
 * `baseArgs` under the given key. The downstream tool's `inputSchema` decides
 * how the content is injected: a parameter typed `object`/`array` is JSON-
 * parsed into structured data (a raw string would fail the downstream schema
 * with "Expected object, given string"), while everything else — the common
 * case of long-form text bodies — is injected verbatim as a UTF-8 string.
 * Throws FileArgsError on any validation failure so the caller can surface the
 * message verbatim to the model.
 */
export async function resolveFileArgs(
  fileArgs: unknown,
  baseArgs: Record<string, unknown>,
  inputSchema?: ToolInputSchema,
): Promise<Record<string, unknown>> {
  if (fileArgs === undefined || fileArgs === null) return baseArgs;
  if (
    typeof fileArgs !== "object" ||
    Array.isArray(fileArgs)
  ) {
    throw new FileArgsError(
      "file_args must be an object mapping arg name to absolute file path",
    );
  }

  const entries = Object.entries(fileArgs as Record<string, unknown>);
  if (entries.length === 0) return baseArgs;

  const merged: Record<string, unknown> = { ...baseArgs };
  const maxBytes = fileArgsMaxBytes();

  for (const [argName, filePathRaw] of entries) {
    if (typeof filePathRaw !== "string" || filePathRaw === "") {
      throw new FileArgsError(
        `file_args.${argName} must be a non-empty string path`,
      );
    }
    if (!path.isAbsolute(filePathRaw)) {
      throw new FileArgsError(
        `file_args.${argName} must be an absolute path; got "${filePathRaw}"`,
      );
    }
    if (argName in baseArgs) {
      throw new FileArgsError(
        `file_args.${argName} conflicts with arguments.${argName}; remove one`,
      );
    }

    let stat;
    try {
      stat = await fs.stat(filePathRaw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new FileArgsError(
        `file_args.${argName}: cannot read "${filePathRaw}": ${msg}`,
      );
    }
    if (!stat.isFile()) {
      throw new FileArgsError(
        `file_args.${argName}: "${filePathRaw}" is not a regular file`,
      );
    }
    if (stat.size > maxBytes) {
      throw new FileArgsError(
        `file_args.${argName}: "${filePathRaw}" is ${stat.size} bytes, exceeds ${maxBytes} byte limit (set GLEAN_FILE_ARG_MAX_BYTES to override)`,
      );
    }

    const content = await fs.readFile(filePathRaw, "utf-8");
    const types = declaredParamTypes(inputSchema, argName);
    if (types.has("object") || types.has("array")) {
      try {
        merged[argName] = JSON.parse(content);
      } catch (err) {
        // A union like ["string", "object"] can legitimately take raw text, so
        // keep the string. A pure object/array param cannot — fail with a clear
        // message before the opaque downstream "Expected object, given string".
        if (types.has("string")) {
          merged[argName] = content;
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          throw new FileArgsError(
            `file_args.${argName}: "${filePathRaw}" must contain valid JSON for the object/array-typed parameter, but parsing failed: ${msg}`,
          );
        }
      }
    } else {
      merged[argName] = content;
    }
  }

  return merged;
}

interface ToolMetadata {
  name?: string;
  description?: string;
  server_id?: string;
  inputSchema?: ToolInputSchema;
  annotations?: Tool["annotations"];
}

async function findToolJsons(
  skillsBaseDir: string,
  toolName: string,
): Promise<ToolMetadata[]> {
  const metadata: ToolMetadata[] = [];
  try {
    const skillDirs = await fs.readdir(skillsBaseDir, { withFileTypes: true });
    for (const dir of skillDirs) {
      if (!dir.isDirectory()) continue;
      const toolPath = path.join(skillsBaseDir, dir.name, "tools", `${toolName}.json`);
      try {
        const content = await fs.readFile(toolPath, "utf-8");
        const parsed: unknown = JSON.parse(content);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          metadata.push(parsed as ToolMetadata);
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Skills dir doesn't exist or can't be read
  }
  return metadata;
}

// Only downstream annotations for this exact server/tool can exempt a failed
// lookup from approval. Conflicting cached copies or unknown annotations must
// not suppress the gate. Cached requires_approval preferences are never read.
function isKnownReadOnlyTool(
  metadata: ToolMetadata[],
  serverId: string,
  toolName: string,
): boolean {
  const matches = metadata.filter(
    (tool) => tool.server_id === serverId && tool.name === toolName,
  );
  return matches.length > 0 && matches.every(({ annotations }) =>
    annotations?.readOnlyHint === true &&
    (annotations.destructiveHint === undefined || annotations.destructiveHint === false),
  );
}

// A stdio server's only client signal is clientInfo.name; Cursor reports
// "cursor-vscode". Used to explain the known dropped-elicitation failure mode
// when an approval request waits out its full timeout.
export function isCursorClient(mcpServer: Server): boolean {
  return (mcpServer.getClientVersion()?.name ?? "")
    .toLowerCase()
    .startsWith("cursor");
}

// Keep this form aligned with Scio's run_tool approval UX: one required enum,
// with Always Allow first and selected by default.
const approvalField = "approval";
const approvalAlwaysAllow = "Always Allow";
const approvalAllow = "Allow";
const approvalDeny = "Deny";
const approvalCancel = "cancel";
const approvalChoices = [
  approvalAlwaysAllow,
  approvalAllow,
  approvalDeny,
] as const;
type ApprovalChoice = (typeof approvalChoices)[number];
type ApprovalDecision = ApprovalChoice | typeof approvalCancel;

function runToolApprovalForm(toolName: string) {
  return {
    mode: "form" as const,
    message:
      `Allow running the write tool ${toolName}?\n\n` +
      `Always Allow is selected by default. Accepting with this selection ` +
      `saves approval for future calls to this tool. To change it, select a ` +
      `different Approval option below.`,
    requestedSchema: {
      type: "object",
      required: [approvalField],
      properties: {
        [approvalField]: {
          type: "string",
          title: "Approval",
          description: `Whether to run ${toolName}.`,
          enum: [...approvalChoices],
          default: approvalChoices[0],
        },
      },
    } as any,
  };
}

function approvalDecision(result: {
  action: string;
  content?: unknown;
}): ApprovalDecision | null {
  if (result.action === "decline") return approvalDeny;
  if (result.action === "cancel") return approvalCancel;
  if (result.action !== "accept") return null;
  if (
    typeof result.content !== "object" ||
    result.content === null ||
    Array.isArray(result.content)
  ) {
    return null;
  }
  const choice = (result.content as Record<string, unknown>)[approvalField];
  return approvalChoices.find((candidate) => candidate === choice) ?? null;
}

// A WeakSet so a short-lived server in tests doesn't leak,
// and so the burn happens exactly once per server instance.
const elicitationIdPrimed = new WeakSet<object>();
function primeElicitationCancellation(mcpServer: Server): void {
  if (elicitationIdPrimed.has(mcpServer)) return;
  elicitationIdPrimed.add(mcpServer);
  void mcpServer.request({ method: "ping" }, EmptyResultSchema).catch(() => {
    // Ping rejection is fine: request id 0 is already consumed by this call
  });
}

// Path to the per-session permission-mode marker the PreToolUse hook writes
// immediately before each run_tool call (see hooks/auto-approve-run-tool.mjs).
// The directory has to be the one the HOOK can compute, not the one this process
// would prefer -- see hostSharedDataDir() in ../data-dir.ts.
function permissionModeMarkerPath(): string {
  const sessionId = resolveSessionId()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);
  return path.join(hostSharedDataDir(), "glean-hitl-mode", `${sessionId}.json`);
}

// Claude Code's live permission mode for THIS session, as captured by the hook
// on the current call. Returns null when the marker is missing, unreadable, or
// malformed — the caller treats null as "unknown" and keeps the approval gate,
// so any failure fails toward prompting, never toward a silent bypass.
//
// Resume safety: the PreToolUse hook rewrites this marker with the CURRENT mode
// on every run_tool call (see hooks/auto-approve-run-tool.mjs), and PreToolUse
// always runs before the tool executes, so the value read here is the one
// written for this exact call. A session first launched with
// --dangerously-skip-permissions and later resumed WITHOUT it (same session id)
// therefore has its stale bypass marker overwritten with the resumed mode on
// the resumed session's first run_tool call, re-engaging the gate.
async function currentPermissionMode(): Promise<string | null> {
  try {
    const raw = await fs.readFile(permissionModeMarkerPath(), "utf-8");
    const parsed = JSON.parse(raw) as { permission_mode?: unknown };
    return typeof parsed.permission_mode === "string"
      ? parsed.permission_mode
      : null;
  } catch {
    return null;
  }
}

function humanizeMs(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 120) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function elicitationFailureText(
  mcpServer: Server,
  toolName: string,
  detail: string,
  elapsedMs: number,
  timeoutMs: number,
): string {
  const base =
    `Action ${toolName} was not approved — the approval request failed ` +
    `(${detail}). The action was NOT executed.`;
  const waitedFullTimeout = elapsedMs >= timeoutMs * 0.9;
  if (!waitedFullTimeout || !isCursorClient(mcpServer)) {
    return `${base} Ask the user to confirm, then retry.`;
  }
  return (
    `${base}\n\n` +
    `It waited the full ${humanizeMs(timeoutMs)} without an answer. Either the approval ` +
    `prompt was shown and went unanswered, or it was never shown at all — this end ` +
    `cannot tell which. One possible cause, if no prompt appeared, is a known Cursor ` +
    `issue before version 3.15: a server-initiated approval prompt can be dropped ` +
    `silently, leaving nothing on screen to accept or dismiss. Ask the user whether they ` +
    `saw an approval prompt. If they did not, suggest checking Cursor's version and ` +
    `updating if it is below 3.15 — otherwise a retry may wait out the clock again.`
  );
}

export interface RunToolPolicy {
  fileArgs: boolean;
}

class ToolApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolApprovalError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function approvalResponsePayload(result: CallToolResult): unknown {
  const structured = (result as CallToolResult & {
    structuredContent?: unknown;
  }).structuredContent;
  if (structured !== undefined) return structured;

  const text = result.content.find((item) => item.type === "text");
  if (!text || text.type !== "text") return undefined;
  try {
    return JSON.parse(text.text);
  } catch {
    return undefined;
  }
}

/**
 * Ask the remote control plane whether this downstream tool requires approval.
 *
 * This is deliberately a per-call lookup. The answer is not read from skill files,
 * stored in this process, or persisted locally. A missing, malformed, or failed
 * response throws so the caller can require approval unless the downstream tool
 * is known to be read-only, rather than aborting the downstream call.
 */
export async function getToolApproval(
  remoteClient: Client,
  serverId: string,
  toolName: string,
): Promise<boolean> {
  let result: CallToolResult;
  try {
    result = await callRemoteTool(remoteClient, "get_tool_approval", {
      server_id: serverId,
      tool_name: toolName,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ToolApprovalError(`remote lookup failed: ${detail}`);
  }

  if (result.isError) {
    const text = result.content.find((item) => item.type === "text");
    const detail = text?.type === "text" ? text.text : "remote lookup returned an error";
    throw new ToolApprovalError(detail);
  }

  const payload = approvalResponsePayload(result);
  if (!isRecord(payload) || typeof payload.requires_approval !== "boolean") {
    throw new ToolApprovalError(
      "remote response did not contain boolean requires_approval",
    );
  }
  return payload.requires_approval;
}

export async function handleRunTool(
  remoteClient: Client,
  mcpServer: Server,
  skillsBaseDir: string,
  args: Record<string, unknown>,
  policy: RunToolPolicy,
): Promise<CallToolResult> {
  const serverId = args.server_id;
  const toolName = args.tool_name;

  if (typeof serverId !== "string" || typeof toolName !== "string") {
    return {
      content: [
        { type: "text", text: "server_id and tool_name are required strings" },
      ],
      isError: true,
    };
  }

  // Cache files supply inputSchema and downstream annotations for the read-only
  // fallback. Approval preferences are still fetched remotely on every call;
  // cached requires_approval values are never used.
  const toolMetadata = await findToolJsons(skillsBaseDir, toolName);
  const toolMeta = toolMetadata[0];

  // Refuse before reading any model-supplied path. Disabled file_args must be
  // inert, not merely absent from the advertised schema.
  if (!policy.fileArgs && args.file_args !== undefined) {
    return {
      content: [{ type: "text", text: FILE_ARGS_DISABLED_TEXT }],
      isError: true,
    };
  }

  // Resolve file_args before approval so the approved call uses the complete
  // input and an unreadable model-supplied path fails before we prompt the user.
  const baseArgs =
    args.arguments != null && typeof args.arguments === "object"
      ? (args.arguments as Record<string, unknown>)
      : {};
  let resolvedArgs: Record<string, unknown>;
  try {
    resolvedArgs = await resolveFileArgs(
      args.file_args,
      baseArgs,
      toolMeta?.inputSchema,
    );
  } catch (err) {
    if (err instanceof FileArgsError) {
      return {
        content: [{ type: "text", text: err.message }],
        isError: true,
      };
    }
    throw err;
  }

  let requiresApproval = true;
  try {
    requiresApproval = await getToolApproval(remoteClient, serverId, toolName);
  } catch (err) {
    requiresApproval = !isKnownReadOnlyTool(toolMetadata, serverId, toolName);
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `[get_tool_approval] ${toolName}: ${detail}; defaulting to requires_approval=${requiresApproval}`,
    );
  }

  const hitlEnabled = process.env.ENABLE_HITL === "true";
  // Cursor is deliberately not excepted: current Cursor builds can use the same
  // local elicitation gate as other capable hosts. Older builds that drop the
  // prompt fail closed, and the timeout response explains the upgrade path.
  if (
    hitlEnabled &&
    requiresApproval &&
    mcpServer.getClientCapabilities()?.elicitation
  ) {
    // In bypassPermissions mode (`claude --dangerously-skip-permissions`) the
    // user has opted out of every approval prompt for the session, so our own
    // elicitation gate is just a redundant popup — skip it and execute
    // directly. The mode comes from the PreToolUse hook, which writes it keyed
    // by session id immediately before this call, so it reflects the current
    // call and never leaks across sessions. Any other or unknown mode keeps the
    // gate. Only bypassPermissions is skipped (deliberately narrow).
    const bypass = (await currentPermissionMode()) === "bypassPermissions";
    if (!bypass) {
      const timeout = hitlTimeoutMs();

      // Make a dummy empty request to burn JSON-RPC request id 0
      primeElicitationCancellation(mcpServer);

      const startedAt = Date.now();
      try {
        const result = await mcpServer.elicitInput(
          runToolApprovalForm(toolName),
          { timeout },
        );
        const decision = approvalDecision(result);

        if (decision === approvalDeny || decision === approvalCancel) {
          return {
            content: [
              {
                type: "text",
                text: `Action ${toolName} was ${decision === approvalDeny ? "declined" : "cancelled"} by the user.`,
              },
            ],
          };
        }
        if (decision === null) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Action ${toolName} was not approved — the approval form ` +
                  `response was invalid. The action was NOT executed.`,
              },
            ],
            isError: true,
          };
        }

        if (decision === approvalAlwaysAllow) {
          try {
            await callRemoteTool(remoteClient, "set_tool_approval", {
              server_id: serverId,
              tool_name: toolName,
              value: "ALWAYS_ALLOWED",
            });
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            console.error(
              `[set_tool_approval] failed to persist "${toolName}" to Glean: ${detail}`,
            );
          }
        }
      } catch (err) {
        // Fail CLOSED. An approval gate that executes the action when the
        // prompt times out or errors defeats its own purpose — and the SDK
        // rejects elicitInput precisely on request timeout.
        const detail = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text",
              text: elicitationFailureText(
                mcpServer,
                toolName,
                detail,
                Date.now() - startedAt,
                timeout,
              ),
            },
          ],
          isError: true,
        };
      }
    }
  }

  return callRemoteTool(
    remoteClient,
    "run_tool",
    buildRemoteArgs(serverId, toolName, resolvedArgs),
  );
}

/**
 * Assemble the payload for the backend `run_tool` meta-tool. `arguments` is
 * ALWAYS included, even when empty: the downstream MCP `tools/call` validates
 * `params.arguments` as an object, and an absent field serializes to `null`,
 * which strict downstream servers reject ("Expected: object, given: null").
 * Sending an explicit `{}` for no-argument tools matches what the MCP SDK
 * does for direct tool calls.
 */
export function buildRemoteArgs(
  serverId: string,
  toolName: string,
  resolvedArgs: Record<string, unknown>,
): Record<string, unknown> {
  return {
    server_id: serverId,
    tool_name: toolName,
    arguments: resolvedArgs,
  };
}

/**
 * Annotations for the `run_tool` meta-tool. When HITL is active for an
 * elicitation-capable client, our own approval prompt is the gate, so we mark
 * the tool `readOnlyHint` to suppress the client's native run-tool confirmation
 * and avoid a double prompt. Without HITL there is no gate of our own, so we
 * leave annotations unset and let the client decide. Cursor follows the same
 * path: if an older build drops the elicitation, execution remains blocked and
 * elicitationFailureText explains the known pre-3.15 issue.
 */
export function runToolAnnotations(
  enableHitl: boolean,
  clientSupportsElicitation: boolean,
): Tool["annotations"] {
  return enableHitl && clientSupportsElicitation
    ? { readOnlyHint: true }
    : undefined;
}
