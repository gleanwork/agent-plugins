import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleFindSkills } from "../src/tools/find-skills.js";
import { SkillFileCache } from "../src/skill-files.js";
import type { SkillsMap } from "../src/types.js";

function createMockClient(skills: SkillsMap) {
  return {
    callTool: vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ skills }),
        },
      ],
    }),
    close: vi.fn(),
  } as any;
}

describe("handleFindSkills", () => {
  let skillFiles: SkillFileCache;

  beforeEach(() => {
    skillFiles = new SkillFileCache();
  });

  it("calls find_skills and returns an in-memory compatibility index", async () => {
    const mockClient = createMockClient({
      "search-jira": {
        "SKILL.md":
          "---\nname: search-jira\ndescription: Search Jira issues\n---\n# Search Jira",
        "tools/jirasearch.json": JSON.stringify({
          server_id: "composio/jira-pack",
          tool_name: "jirasearch",
          description: "Search Jira",
          input_schema: {},
        }),
      },
    });

    const result = await handleFindSkills(mockClient, skillFiles, {});

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "find_skills",
        arguments: {},
      }),
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );

    expect(result).toContain("<available_skills>");
    expect(result).toContain('name="search-jira"');

    expect(skillFiles.legacy.read("search-jira", ["SKILL.md"])?.files).toEqual({
      "SKILL.md": expect.stringContaining("# Search Jira"),
    });
  });

  it("passes query argument as queries array", async () => {
    const mockClient = createMockClient({});

    await handleFindSkills(mockClient, skillFiles, {
      query: "create a calendar event",
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "find_skills",
        arguments: { queries: ["create a calendar event"] },
      }),
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("passes queries array when provided", async () => {
    const mockClient = createMockClient({});

    await handleFindSkills(mockClient, skillFiles, {
      queries: ["search emails", "create calendar event"],
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "find_skills",
        arguments: { queries: ["search emails", "create calendar event"] },
      }),
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("returns empty XML when response has no skills field", async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ unexpected: true }) }],
      }),
      close: vi.fn(),
    } as any;

    const result = await handleFindSkills(mockClient, skillFiles, {});
    expect(result).toBe("<available_skills />");
  });

  it("returns empty XML for no skills", async () => {
    const mockClient = createMockClient({});

    const result = await handleFindSkills(mockClient, skillFiles, {});

    expect(result).toBe("<available_skills />");
  });

  it("handles missing text content gracefully", async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      close: vi.fn(),
    } as any;

    const result = await handleFindSkills(mockClient, skillFiles, {});

    expect(result).toBe("<available_skills />");
  });

  it("throws with upstream message when find_skills returns an error", async () => {
    const mockClient = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "backend unavailable" }],
        isError: true,
      }),
      close: vi.fn(),
    } as any;

    await expect(
      handleFindSkills(mockClient, skillFiles, {}),
    ).rejects.toThrow("backend unavailable");
  });
});
