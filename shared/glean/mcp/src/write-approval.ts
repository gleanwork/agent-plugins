import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  consumeBypassReceipt,
  PERMISSION_CONTEXT_ARG,
  stripPermissionContext,
} from "../approval-context.mjs";
import { hostSharedDataDir } from "./data-dir.js";
import type { RemoteClientOptions } from "./remote-client.js";

export interface ToolApprovalContext {
  args: Record<string, unknown>;
  approvalEnabled: boolean;
}

// The hook carries a one-use receipt, not a model-supplied permission mode. This
// also works when Claude does not export its session ID to the MCP process.
export function resolveToolApprovalContext(
  toolName: string,
  input: Record<string, unknown>,
): ToolApprovalContext {
  const args = stripPermissionContext(input);
  const hitlEnabled = process.env.ENABLE_HITL === "true";
  const bypass = hitlEnabled && consumeBypassReceipt(
    hostSharedDataDir(), input[PERMISSION_CONTEXT_ARG], toolName, args,
  );
  return { args, approvalEnabled: hitlEnabled && !bypass };
}

export function withPermissionContext(tool: Tool): Tool {
  return {
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        ...tool.inputSchema.properties,
        [PERMISSION_CONTEXT_ARG]: {
          type: "string",
          description: "Internal Claude hook context. Leave unset.",
        },
      },
    },
  };
}

export function remoteElicitationOptions(
  server: Server,
  approvalEnabled: boolean,
): Pick<RemoteClientOptions, "elicitInput"> {
  // Without the callback, createRemoteClient advertises no upstream elicitation
  // capability. Do not synthesize an approval or persist an Always Allow choice.
  if (!approvalEnabled || !server.getClientCapabilities()?.elicitation) return {};
  return {
    elicitInput: (params, options) => server.elicitInput(
      { message: params.message, requestedSchema: params.requestedSchema },
      options,
    ),
  };
}
