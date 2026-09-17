import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { handleFindSkills } from "../src/tools/find-skills.js";
import type { SkillsMap } from "../src/types.js";

const listTools = (...names: string[]) =>
  vi.fn().mockResolvedValue({ tools: names.map((name) => ({ name })) });

function createMockClient(skills: SkillsMap, remoteName = "find_skills_and_tools") {
  return {
    listTools: listTools(remoteName),
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
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "find-skills-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("calls find_skills_and_tools and writes skill files", async () => {
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

    const result = await handleFindSkills(mockClient, tmpDir, {});

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "find_skills_and_tools",
        arguments: {},
      }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );

    expect(result).toContain("<available_skills>");
    expect(result).toContain('name="search-jira"');

    const skillContent = await fs.readFile(
      path.join(tmpDir, "search-jira", "SKILL.md"),
      "utf-8",
    );
    expect(skillContent).toContain("# Search Jira");
  });

  it("passes query argument as queries array", async () => {
    const mockClient = createMockClient({});

    await handleFindSkills(mockClient, tmpDir, {
      query: "create a calendar event",
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "find_skills_and_tools",
        arguments: { queries: ["create a calendar event"] },
      }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("passes queries array when provided", async () => {
    const mockClient = createMockClient({});

    await handleFindSkills(mockClient, tmpDir, {
      queries: ["search emails", "create calendar event"],
    });

    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "find_skills_and_tools",
        arguments: { queries: ["search emails", "create calendar event"] },
      }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("returns empty XML when response has no skills field", async () => {
    const mockClient = {
      listTools: listTools("find_skills_and_tools"),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ unexpected: true }) }],
      }),
      close: vi.fn(),
    } as any;

    const result = await handleFindSkills(mockClient, tmpDir, {});
    expect(result).toBe("<available_skills />");
  });

  it("returns empty XML for no skills", async () => {
    const mockClient = createMockClient({});

    const result = await handleFindSkills(mockClient, tmpDir, {});

    expect(result).toBe("<available_skills />");
  });

  it("handles missing text content gracefully", async () => {
    const mockClient = {
      listTools: listTools("find_skills_and_tools"),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      close: vi.fn(),
    } as any;

    const result = await handleFindSkills(mockClient, tmpDir, {});

    expect(result).toBe("<available_skills />");
  });

  it("throws with upstream message when find_skills returns an error", async () => {
    const mockClient = {
      listTools: listTools("find_skills"),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "backend unavailable" }],
        isError: true,
      }),
      close: vi.fn(),
    } as any;

    await expect(
      handleFindSkills(mockClient, tmpDir, {}),
    ).rejects.toThrow("backend unavailable");
  });

  it("names the route misconfiguration when the remote answers with the lazy XML index", async () => {
    const mockClient = {
      listTools: listTools("find_skills_and_tools"),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "<available_skills>\n</available_skills>" }],
      }),
      close: vi.fn(),
    } as any;

    await expect(handleFindSkills(mockClient, tmpDir, {})).rejects.toThrow(
      /gateway\/proxy/,
    );
  });

  it("falls back to legacy find_skills when the host has not been renamed", async () => {
    const mockClient = createMockClient({}, "find_skills");
    await handleFindSkills(mockClient, tmpDir, {});
    expect(mockClient.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ name: "find_skills" }),
      expect.anything(),
    );
  });

  it("resolves the remote name once per client", async () => {
    const mockClient = createMockClient({});
    await handleFindSkills(mockClient, tmpDir, {});
    await handleFindSkills(mockClient, tmpDir, {});
    expect(mockClient.listTools).toHaveBeenCalledTimes(1);
  });
});
