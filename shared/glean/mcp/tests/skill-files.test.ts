import { describe, expect, it } from "vitest";
import {
  SkillFileCache,
  ToolMetadataCache,
  formatLegacySkillIndex,
  formatReadSkillFilesResponse,
} from "../src/skill-files.js";

describe("ToolMetadataCache", () => {
  it("indexes tool metadata from a remote read response", () => {
    const cache = new ToolMetadataCache();
    cache.ingestReadResponse(
      `<files>\n` +
        `  <file path="tools/send.json"><![CDATA[{"name":"send","server_id":"slack","requires_approval":true,"inputSchema":{"properties":{"payload":{"type":"object"}}}}]]></file>\n` +
        `</files>`,
    );

    expect(cache.get("slack", "send")).toEqual({
      name: "send",
      server_id: "slack",
      requires_approval: true,
      inputSchema: { properties: { payload: { type: "object" } } },
    });
  });

  it("joins a server-split CDATA terminator before parsing JSON", () => {
    const cache = new ToolMetadataCache();
    const content = JSON.stringify({
      name: "send",
      server_id: "slack",
      requires_approval: false,
      description: "]]>",
    });
    const splitContent = content.replaceAll("]]>", "]]]]><![CDATA[>");
    cache.ingestReadResponse(
      `<files><file path="tools/send.json"><![CDATA[${splitContent}]]></file></files>`,
    );

    expect(cache.get("slack", "send")?.requires_approval).toBe(false);
  });
});

describe("legacy skill compatibility", () => {
  const skills = {
    "search-jira": {
      "SKILL.md": "---\nname: search-jira\ndescription: Search Jira\n---\n# Search",
      "tools/search.json": JSON.stringify({
        name: "search",
        server_id: "jira",
        requires_approval: false,
      }),
    },
  };

  it("formats an index with remote file paths, not local paths", () => {
    const index = formatLegacySkillIndex(skills);
    expect(index).toContain('name="search-jira"');
    expect(index).toContain("<path>SKILL.md</path>");
    expect(index).not.toContain("/tmp/");
  });

  it("serves requested files from the compatibility cache", () => {
    const cache = new SkillFileCache();
    cache.ingestLegacySkills(skills);
    const result = cache.legacy.read("search-jira", ["SKILL.md", "missing.md"]);

    expect(
      formatReadSkillFilesResponse(
        ["SKILL.md", "missing.md"],
        result!.files,
        result!.availableFiles,
      ),
    ).toContain('error_reason="not_found"');
    expect(cache.metadata.get("jira", "search")?.requires_approval).toBe(false);
  });
});
