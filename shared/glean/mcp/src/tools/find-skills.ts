import type { Client } from "@modelcontextprotocol/client";
import { callRemoteTool } from "../remote-client.js";
import { writeSkillsToDisk, formatAvailableSkillsPrompt } from "../skill-writer.js";
import type { SkillsMap } from "../types.js";

// ponytail: the remote exposes either the new or the legacy name during the
// rename rollout. Resolve once per client via tools/list (the client is a
// process singleton, so this is one extra round trip per process).
// Drop this and hardcode "find_skills_and_tools" once every host has upgraded.
const REMOTE_NAMES = ["find_skills_and_tools", "find_skills"] as const;
const resolvedRemoteName = new WeakMap<Client, string>();

async function resolveRemoteName(client: Client): Promise<string> {
  const cached = resolvedRemoteName.get(client);
  if (cached) return cached;
  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  const name = REMOTE_NAMES.find((n) => names.has(n)) ?? REMOTE_NAMES[0];
  resolvedRemoteName.set(client, name);
  return name;
}

export async function handleFindSkills(
  remoteClient: Client,
  skillsBaseDir: string,
  args: Record<string, unknown>,
): Promise<string> {
  const toolArgs: Record<string, unknown> = {};
  if (Array.isArray(args.queries)) {
    toolArgs.queries = args.queries;
  } else if (typeof args.query === "string") {
    toolArgs.queries = [args.query];
  }

  const remoteName = await resolveRemoteName(remoteClient);
  const result = await callRemoteTool(remoteClient, remoteName, toolArgs);

  const textContent = result.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return "<available_skills />";
  }

  if (result.isError) {
    throw new Error(textContent.text || `${remoteName} failed`);
  }

  // ponytail: lazy-disclosure surfaces (/mcp/default, skill-pack servers)
  // answer with an XML index and expect read_skill_files; the plugin only
  // speaks the gateway/proxy JSON map. Name the misconfiguration instead of
  // surfacing "Unexpected token '<'".
  if (textContent.text.trimStart().startsWith("<")) {
    throw new Error(
      `${remoteName} returned a lazy-disclosure XML index instead of the skills JSON map; ` +
        "point the plugin at the /mcp/gateway/proxy route (check GLEAN_MCP_SERVER_URL).",
    );
  }

  const parsed = JSON.parse(textContent.text) as { skills?: SkillsMap };
  if (!parsed.skills || typeof parsed.skills !== "object") {
    console.error(
      `${remoteName}: unexpected response shape, keys: ${Object.keys(parsed).join(", ")}`,
    );
    return "<available_skills />";
  }
  const index = await writeSkillsToDisk(parsed.skills, skillsBaseDir);
  return formatAvailableSkillsPrompt(index);
}
