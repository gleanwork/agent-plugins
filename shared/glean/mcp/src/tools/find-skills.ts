import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callRemoteTool } from "../remote-client.js";
import {
  formatLegacySkillIndex,
  parseLegacySkillsResponse,
  type SkillFileCache,
} from "../skill-files.js";

export async function handleFindSkills(
  remoteClient: Client,
  skillFiles: SkillFileCache,
  args: Record<string, unknown>,
): Promise<string> {
  const toolArgs: Record<string, unknown> = {};
  if (Array.isArray(args.queries)) {
    toolArgs.queries = args.queries;
  } else if (typeof args.query === "string") {
    toolArgs.queries = [args.query];
  }

  const result = await callRemoteTool(remoteClient, "find_skills", toolArgs);

  const textContent = result.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return "<available_skills />";
  }

  if (result.isError) {
    throw new Error(textContent.text || "find_skills failed");
  }

  // A fresh discovery result is the authority for the current session. Drop
  // metadata from previous discovery results so a changed approval policy can
  // never reuse an old requires_approval value.
  skillFiles.clear();

  const text = textContent.text.trim();
  if (text.startsWith("<available_skills")) {
    return textContent.text;
  }

  // Older proxy servers return the complete skill tree as JSON. Keep that
  // compatibility path in memory only; new servers return the lazy XML index
  // and are read through read_skill_files below.
  const legacySkills = parseLegacySkillsResponse(text);
  if (legacySkills) {
    skillFiles.ingestLegacySkills(legacySkills);
    return formatLegacySkillIndex(legacySkills);
  }

  console.error("find_skills: unexpected response shape");
  return "<available_skills />";
}
