import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callRemoteTool } from "../remote-client.js";
import {
  formatReadSkillFilesResponse,
  type SkillFileCache,
} from "../skill-files.js";

export async function handleReadSkillFiles(
  remoteClient: Client,
  skillFiles: SkillFileCache,
  args: Record<string, unknown>,
): Promise<string> {
  const skillName = typeof args.skill_name === "string" ? args.skill_name : "";
  const filePaths = Array.isArray(args.file_paths)
    ? args.file_paths.filter((path): path is string => typeof path === "string")
    : [];

  // An older server has already returned the complete response to find_skills.
  // Serve reads from the process-local compatibility cache instead of writing
  // those files to disk or calling a tool the older server does not expose.
  const legacy = skillFiles.legacy.read(skillName, filePaths);
  if (legacy) {
    return formatReadSkillFilesResponse(
      filePaths,
      legacy.files,
      legacy.availableFiles,
    );
  }

  const result = await callRemoteTool(remoteClient, "read_skill_files", {
    skill_name: args.skill_name,
    file_paths: args.file_paths,
  });

  const textContent = result.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return "<files />";
  }
  if (result.isError) {
    throw new Error(textContent.text || "read_skill_files failed");
  }

  skillFiles.metadata.ingestReadResponse(textContent.text);
  return textContent.text;
}
