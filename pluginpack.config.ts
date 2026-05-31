import { defineConfig } from "@gleanwork/pluginpack";

export default defineConfig({
  name: "glean-plugins",
  version: "2.1.1",
  source: {
    plugins: "sources",
    skills: "skills",
    rootPlugin: {
      id: "cursor-skills",
      description: "Portable Glean skills for AI coding tools.",
    },
  },
  metadata: {
    author: {
      name: "Glean",
      email: "steve.calvert@glean.com",
      url: "https://glean.com",
    },
    owner: { name: "Glean", email: "steve.calvert@glean.com" },
    homepage: "https://docs.glean.com/administration/platform/mcp/about",
    repository: "https://github.com/gleanwork/agent-plugins",
    license: "MIT",
  },
  targets: {
    claude: {
      outDir: ".",
      version: "2.0.0",
      manifest: {
        description:
          "Official Glean plugins for Claude Code - enterprise knowledge integration",
      },
      plugins: {
        "glean-core": { from: ["claude-glean-core"], path: "plugins/glean-core" },
        "glean-search": { from: ["claude-glean-search"], path: "plugins/glean-search" },
        "glean-people": { from: ["claude-glean-people"], path: "plugins/glean-people" },
        "glean-meetings": { from: ["claude-glean-meetings"], path: "plugins/glean-meetings" },
        "glean-docs": { from: ["claude-glean-docs"], path: "plugins/glean-docs" },
        "glean-code": { from: ["claude-glean-code"], path: "plugins/glean-code" },
        "glean-dev-docs": { from: ["claude-glean-dev-docs"], path: "plugins/glean-dev-docs" },
        "glean-skills": { from: ["claude-glean-skills"], path: "plugins/glean-skills" },
        "glean-productivity": { from: ["claude-glean-productivity"], path: "plugins/glean-productivity" },
        "glean-project": { from: ["claude-glean-project"], path: "plugins/glean-project" },
      },
    },
    cursor: {
      outDir: ".",
      version: "2.1.1",
      manifest: {
        metadata: {
          description:
            "Official Glean plugin for Cursor — enterprise knowledge, code search, and people discovery.",
          keywords: [
            "glean",
            "enterprise-search",
            "knowledge-management",
            "productivity",
            "workplace",
            "mcp",
          ],
        },
      },
      plugins: {
        glean: {
          from: ["cursor-glean", "cursor-skills"],
          components: ["skills", "agents", "rules"],
          displayName: "Glean",
          description:
            "Official Glean plugin for Cursor — search documents, Slack, and email; explore code across repos; and find experts and stakeholders.",
          manifest: {
            logo: "assets/avatar.svg",
            keywords: [
              "glean",
              "enterprise-search",
              "knowledge-management",
              "productivity",
              "workplace",
              "code-search",
              "people-search",
              "mcp",
            ],
            category: "productivity",
            tags: [
              "mcp",
              "enterprise",
              "search",
              "documents",
              "slack",
              "code",
              "people",
              "experts",
              "org",
            ],
          },
        },
      },
    },
  },
});
