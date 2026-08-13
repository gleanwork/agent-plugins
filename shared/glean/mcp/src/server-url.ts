const MCP_GATEWAY_PATH = "/mcp/gateway/proxy";

/**
 * Normalize either a normal QE origin or a path-prefixed experimental QE URL
 * to the MCP gateway endpoint.
 */
export function normalizeServerUrl(raw: string): string {
  const parsed = new URL(raw);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const prefix = pathname.endsWith(MCP_GATEWAY_PATH)
    ? pathname.slice(0, -MCP_GATEWAY_PATH.length)
    : pathname === "/"
      ? ""
      : pathname;
  return `${parsed.origin}${prefix}${MCP_GATEWAY_PATH}${parsed.search}`;
}
