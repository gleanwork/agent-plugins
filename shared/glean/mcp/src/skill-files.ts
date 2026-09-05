import yaml from "yaml";
import type { SkillDirectoryMap, SkillsMap } from "./types.js";

export interface ToolInputSchema {
  properties?: Record<string, { type?: string | string[] }>;
}

export interface ToolMetadata {
  requires_approval?: boolean;
  name?: string;
  tool_name?: string;
  description?: string;
  server_id?: string;
  inputSchema?: ToolInputSchema;
  input_schema?: ToolInputSchema;
}

/**
 * Runtime metadata learned from tools/*.json responses. This cache is process
 * local and intentionally contains only tool metadata, not a disk-backed skill
 * tree. Missing metadata is handled fail-closed by run_tool.
 */
export class ToolMetadataCache {
  private readonly byServerAndName = new Map<string, ToolMetadata>();
  private readonly byName = new Map<string, ToolMetadata>();

  clear(): void {
    this.byServerAndName.clear();
    this.byName.clear();
  }

  set(metadata: ToolMetadata): void {
    const toolName = metadata.name ?? metadata.tool_name;
    if (typeof toolName !== "string" || toolName.length === 0) return;

    const normalized: ToolMetadata = {
      ...metadata,
      name: toolName,
      inputSchema: metadata.inputSchema ?? metadata.input_schema,
    };
    if (typeof normalized.server_id === "string" && normalized.server_id.length > 0) {
      this.byServerAndName.set(this.key(normalized.server_id, toolName), normalized);
    }
    this.byName.set(toolName, normalized);
  }

  get(serverId: string, toolName: string): ToolMetadata | null {
    return (
      this.byServerAndName.get(this.key(serverId, toolName)) ??
      this.byName.get(toolName) ??
      null
    );
  }

  ingestSkillFiles(skills: SkillsMap): void {
    for (const fileMap of Object.values(skills)) {
      this.ingestFileMap(fileMap);
    }
  }

  ingestReadResponse(response: string): void {
    const filePattern =
      /<file\b[^>]*\bpath="([^"]+)"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/file>/g;
    for (const match of response.matchAll(filePattern)) {
      const filePath = decodeXml(match[1]);
      if (!filePath.startsWith("tools/") || !filePath.endsWith(".json")) continue;
      this.ingestToolJson(match[2].replaceAll("]]]]><![CDATA[>", "]]>"));
    }
  }

  private ingestFileMap(fileMap: SkillDirectoryMap): void {
    for (const [filePath, content] of Object.entries(fileMap)) {
      if (!filePath.startsWith("tools/") || !filePath.endsWith(".json")) continue;
      this.ingestToolJson(content);
    }
  }

  private ingestToolJson(content: string): void {
    try {
      const parsed = JSON.parse(content) as ToolMetadata;
      if (parsed && typeof parsed === "object") this.set(parsed);
    } catch {
      // A malformed tool file must not weaken the fail-closed run_tool path.
    }
  }

  private key(serverId: string, toolName: string): string {
    return `${serverId}\u0000${toolName}`;
  }
}

/**
 * Compatibility-only in-memory store for the legacy find_skills response. It
 * lets a newer client continue talking to an older server without writing the
 * server's complete skill tree to local disk.
 */
export class LegacySkillCache {
  private skills = new Map<string, SkillDirectoryMap>();

  clear(): void {
    this.skills.clear();
  }

  replace(skills: SkillsMap): void {
    this.skills = new Map(
      Object.entries(skills).map(([name, files]) => [name, { ...files }]),
    );
  }

  read(
    skillName: string,
    filePaths: string[],
  ): { files: Record<string, string>; availableFiles: string[] } | null {
    const fileMap = this.skills.get(skillName);
    if (!fileMap) return null;

    const availableFiles = Object.keys(fileMap).sort();
    const files: Record<string, string> = {};
    for (const filePath of filePaths) {
      const content = fileMap[filePath];
      if (typeof content === "string") files[filePath] = content;
    }
    return { files, availableFiles };
  }
}

export class SkillFileCache {
  readonly metadata = new ToolMetadataCache();
  readonly legacy = new LegacySkillCache();

  clear(): void {
    this.metadata.clear();
    this.legacy.clear();
  }

  ingestLegacySkills(skills: SkillsMap): void {
    this.legacy.replace(skills);
    this.metadata.ingestSkillFiles(skills);
  }
}

export function parseLegacySkillsResponse(text: string): SkillsMap | null {
  try {
    const parsed = JSON.parse(text) as { skills?: unknown };
    if (
      !parsed ||
      typeof parsed.skills !== "object" ||
      parsed.skills === null ||
      Array.isArray(parsed.skills)
    ) {
      return null;
    }
    return parsed.skills as SkillsMap;
  } catch {
    return null;
  }
}

export function formatLegacySkillIndex(skills: SkillsMap): string {
  const entries = Object.entries(skills).map(([skillName, files]) => {
    const frontmatter = parseFrontmatter(files["SKILL.md"] ?? "");
    const description = frontmatter.description ?? "";
    const paths = Object.keys(files).sort();
    const fileLines = paths.map(
      (filePath) => `      <path>${escapeXml(filePath)}</path>`,
    );
    return [
      `  <skill name="${escapeXml(skillName)}" description="${escapeXml(description)}">`,
      "    <files>",
      ...fileLines,
      "    </files>",
      "  </skill>",
    ].join("\n");
  });

  return entries.length === 0
    ? "<available_skills />"
    : ["<available_skills>", ...entries, "</available_skills>"].join("\n");
}

export function formatReadSkillFilesResponse(
  filePaths: string[],
  files: Record<string, string>,
  availableFiles: string[],
): string {
  const lines = ["<files>"];
  for (const filePath of filePaths) {
    const content = files[filePath];
    if (content !== undefined) {
      lines.push(
        `  <file path="${escapeXml(filePath)}"><![CDATA[${sanitizeCdata(content)}]]></file>`,
      );
    } else {
      lines.push(`  <file path="${escapeXml(filePath)}" error_reason="not_found"/>`);
    }
  }
  if (availableFiles.length > 0) {
    lines.push("  <available_files>");
    for (const filePath of availableFiles) {
      lines.push(`    <path>${escapeXml(filePath)}</path>`);
    }
    lines.push("  </available_files>");
  }
  lines.push("</files>");
  return lines.join("\n");
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    const parsed = yaml.parse(match[1]);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function sanitizeCdata(content: string): string {
  return content.replaceAll("]]>", "]]]]><![CDATA[>");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
