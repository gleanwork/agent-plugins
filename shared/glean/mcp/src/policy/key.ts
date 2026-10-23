// The vendor-prefixed `_meta` key carrying the policy exchange. This is an
// application-level Glean extension, not a core MCP method or capability: the
// host never needs to understand it, and the plugin both creates and consumes it.
export const CAPABILITY_POLICY_KEY = "com.glean.mcp/capabilityPolicy";

// The features whose enablement the remote controls. Keep in lockstep with
// FeatureName below -- the array exists so the plugin can declare support for
// exactly the features it implements, no more.
//
// `hitl` lets the remote hand write approval to the host (an admin chose "never ask from
// Glean"). Disabled, run_tool skips its own elicitation and the Claude PreToolUse hook
// stops auto-approving, so the host's native permission prompt becomes the gate. The hook
// records whether it auto-approved each call, and run_tool keeps its own prompt whenever it
// did -- so a hook and server that disagree about the policy fail toward prompting.
export const FEATURE_NAMES = [
  "toolPromotion",
  "metaTools",
  "fileArgs",
  "hitl",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
