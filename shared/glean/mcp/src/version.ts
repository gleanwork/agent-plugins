// The plugin's own version, injected by shared/glean/mcp/build.mjs.
//
// The bundled value is used for MCP serverInfo/clientInfo and remote capability
// policy. It must describe the code actually running, so shipped builds use a
// compiled literal rather than reading a mutable adjacent package.json.
declare const __GLEAN_PLUGIN_VERSION__: string | undefined;

export type VersionSource = "build" | "unknown";

export interface ResolvedVersion {
  version: string;
  source: VersionSource;
}

// `typeof` on an undeclared identifier is safe. Unbundled vitest/tsx runs take
// the honest unknown path; build.mjs makes this path unreachable in shipped
// output and asserts that the define landed.
const BUILD_VERSION: string | undefined =
  typeof __GLEAN_PLUGIN_VERSION__ === "string"
    ? __GLEAN_PLUGIN_VERSION__
    : undefined;

export function pluginVersion(): ResolvedVersion {
  if (BUILD_VERSION) return { version: BUILD_VERSION, source: "build" };
  return { version: "0.0.0", source: "unknown" };
}

export function pluginVersionString(): string {
  return pluginVersion().version;
}
