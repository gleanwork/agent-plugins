import { describe, expect, it, vi } from "vitest";
import { handleReadSkillFiles } from "../src/tools/read-skill-files.js";
import { SkillFileCache } from "../src/skill-files.js";

function remoteWith(text: string) {
  return {
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text }],
    }),
  } as any;
}

describe("handleReadSkillFiles", () => {
  it("relays the server response and caches tool metadata", async () => {
    const response =
      `<files><file path="SKILL.md"><![CDATA[# Search]]></file>` +
      `<file path="tools/search.json"><![CDATA[{"name":"search","server_id":"jira","requires_approval":false}]]></file></files>`;
    const remote = remoteWith(response);
    const cache = new SkillFileCache();

    const result = await handleReadSkillFiles(remote, cache, {
      skill_name: "search-jira",
      file_paths: ["SKILL.md", "tools/search.json"],
    });

    expect(result).toBe(response);
    expect(remote.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "read_skill_files",
        arguments: {
          skill_name: "search-jira",
          file_paths: ["SKILL.md", "tools/search.json"],
        },
      }),
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(cache.metadata.get("jira", "search")?.requires_approval).toBe(false);
  });

  it("uses the legacy in-memory response without calling the server", async () => {
    const remote = remoteWith("unexpected");
    const cache = new SkillFileCache();
    cache.ingestLegacySkills({
      "search-jira": {
        "SKILL.md": "# Search",
        "tools/search.json": JSON.stringify({
          name: "search",
          server_id: "jira",
          requires_approval: false,
        }),
      },
    });

    const result = await handleReadSkillFiles(remote, cache, {
      skill_name: "search-jira",
      file_paths: ["SKILL.md"],
    });

    expect(result).toContain("# Search");
    expect(remote.callTool).not.toHaveBeenCalled();
  });
});
