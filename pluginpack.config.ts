import { defineConfig } from "@gleanwork/pluginpack";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  name: "glean-plugins",
  version: pkg.version,
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
      outDir: "dist/claude",
      version: pkg.version,
      rootFiles: { "README.md": "roots/claude/README.md" },
      manifest: {
        description:
          "Official Glean plugins for Claude Code — enterprise knowledge, search, people, code, and meetings.",
      },
      plugins: {
        glean: {
          from: ["glean-lib", "shared", "claude"],
          components: ["skills", "agents"],
          displayName: "Glean",
          description:
            "Official Glean plugin — search documents, Slack, and email; explore code across repos; find experts and stakeholders; prep for meetings and onboarding.",
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
    cursor: {
      outDir: "dist/cursor",
      version: pkg.version,
      rootFiles: { "README.md": "roots/cursor/README.md" },
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
          components: ["skills", "agents", "rules", "assets"],
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
    codex: {
      outDir: "dist/codex",
      rootFiles: {
        "README.md": "roots/codex/README.md",
        LICENSE: "LICENSE",
      },
      manifest: {
        name: "glean-codex-plugins",
        interface: { displayName: "Glean for Codex" },
      },
      plugins: {
        glean: {
          from: ["glean-lib", "codex"],
          components: ["skills"],
          description:
            "Official Glean plugin — search documents, Slack, and email; explore code across repos; find experts and stakeholders; prep for meetings and onboarding.",
          manifest: {
            interface: {
              displayName: "Glean",
              shortDescription: "Enterprise knowledge in Codex",
              longDescription:
                "Search enterprise documents, Slack, email, code, and people; prepare for meetings; and synthesize trusted company knowledge in Codex.",
              developerName: "Glean",
              category: "Productivity",
              capabilities: ["Read", "Search"],
              defaultPrompt: [
                "Search Glean for the latest project decision.",
                "Find an expert on this codebase.",
                "Prepare me for my next meeting.",
              ],
            },
          },
          entry: {
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL",
            },
            category: "Productivity",
          },
        },
        "glean-dev-docs": {
          from: ["dev-docs"],
          components: ["skills"],
          description:
            "Search the public Glean developer documentation — APIs, SDKs, MCP, and integration guides for building with Glean.",
          manifest: {
            homepage: "https://developers.glean.com/",
            interface: {
              displayName: "Glean Developer Docs",
              shortDescription: "Build with Glean in Codex",
              longDescription:
                "Search public Glean API, SDK, MCP, authentication, and integration documentation while you build in Codex.",
              developerName: "Glean",
              category: "Productivity",
              capabilities: ["Read", "Search"],
              defaultPrompt: [
                "How do I authenticate with the Glean API?",
                "Find the Glean Indexing API documentation.",
                "Show me a Glean SDK example.",
              ],
            },
          },
          entry: {
            policy: {
              installation: "AVAILABLE",
              authentication: "ON_INSTALL",
            },
            category: "Productivity",
          },
        },
      },
    },
  },
});
