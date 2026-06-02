import { defineConfig } from "@gleanwork/pluginpack";

export default defineConfig({
  name: "glean-plugins",
  version: "2.2.0",
  source: {
    plugins: "sources",
    skills: "skills",
    rootPlugin: {
      id: "glean-lib",
      description: "Portable Glean skill library.",
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
      version: "2.2.0",
      manifest: {
        description:
          "Official Glean plugins for Claude Code — enterprise knowledge, search, people, code, and meetings.",
      },
      plugins: {
        glean: {
          from: ["glean-lib", "shared", "claude"],
          components: ["skills", "agents", "commands", "hooks"],
          displayName: "Glean",
          description:
            "Official Glean plugin — search documents, Slack, and email; explore code across repos; find experts and stakeholders; prep for meetings and onboarding.",
        },
        "glean-dev-docs": {
          from: ["dev-docs"],
          components: ["skills", "commands"],
          displayName: "Glean Developer Docs",
          description:
            "Search the public Glean developer documentation — APIs, SDKs, MCP, and integration guides for building with Glean.",
        },
      },
    },
    cursor: {
      outDir: ".",
      version: "2.2.0",
      manifest: {
        metadata: {
          description:
            "Official Glean plugins for Cursor — enterprise knowledge, code search, and people discovery.",
          keywords: ["glean", "enterprise-search", "knowledge-management", "productivity", "workplace", "mcp"],
        },
      },
      plugins: {
        glean: {
          from: ["glean-lib", "shared", "cursor"],
          components: ["skills", "agents", "rules", "commands", "assets"],
          displayName: "Glean",
          description:
            "Official Glean plugin — search documents, Slack, and email; explore code across repos; find experts and stakeholders; prep for meetings and onboarding.",
          manifest: {
            logo: "assets/avatar.svg",
            keywords: ["glean", "enterprise-search", "knowledge-management", "productivity", "workplace", "code-search", "people-search", "mcp"],
            category: "productivity",
            tags: ["mcp", "enterprise", "search", "documents", "slack", "code", "people", "experts", "org"],
          },
        },
        "glean-dev-docs": {
          from: ["dev-docs"],
          components: ["skills"],
          displayName: "Glean Developer Docs",
          description:
            "Search the public Glean developer documentation — APIs, SDKs, MCP, and integration guides for building with Glean.",
        },
      },
    },
  },
});
