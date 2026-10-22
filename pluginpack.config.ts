import { defineConfig } from "@gleanwork/pluginpack";
import pkg from "./package.json" with { type: "json" };

const gleanPluginDescription =
  "Use Glean to search your company's knowledge, chat with Glean Assistant, and discover and use the skills and connected tools available to your organization.";

const devDocsDescription =
  "Search the public Glean developer documentation — APIs, SDKs, MCP, and integration guides for building with Glean.";

// Codex's plugin card. The codex target moves it under
// extensions["com.openai"] itself; the agent-plugins target needs it there
// explicitly, because one package serves several clients.
const gleanCodexInterface = {
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
  composerIcon: "./assets/avatar.png",
  logo: "./assets/avatar.png",
};

const devDocsCodexInterface = {
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
  composerIcon: "./assets/avatar.png",
  logo: "./assets/avatar.png",
};

// Codex marketplace entry fields pluginpack can't derive.
const codexEntry = {
  policy: {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  },
  category: "Productivity",
};

export default defineConfig({
  name: "glean-plugins",
  version: pkg.version,
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
      repositoryFiles: "overrides/claude/root",
      manifest: {
        description:
          "Official Glean plugins for Claude — enterprise knowledge, search, people, code, and meetings.",
      },
      plugins: {
        glean: {
          source: "shared/glean",
          overrides: "overrides/claude/glean",
          displayName: "Glean",
          description: gleanPluginDescription,
        },
        "glean-dev-docs": {
          source: "shared/glean-dev-docs",
          include: ["skills", "static"],
          displayName: "Glean Developer Docs",
          description:
            "Search the public Glean developer documentation — APIs, SDKs, MCP, and integration guides for building with Glean.",
        },
      },
    },
    cursor: {
      outDir: "dist/cursor",
      version: pkg.version,
      repositoryFiles: "overrides/cursor/root",
      manifest: {
        metadata: {
          description:
            "Official Glean plugins for Cursor — enterprise knowledge, code search, and people discovery.",
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
          source: "shared/glean",
          overrides: "overrides/cursor/glean",
          exclude: ["hooks", "scripts"],
          displayName: "Glean",
          description: gleanPluginDescription,
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
        "glean-dev-docs": {
          source: "shared/glean-dev-docs",
          include: ["skills", "static"],
          displayName: "Glean Developer Docs",
          description:
            "Search the public Glean developer documentation — APIs, SDKs, MCP, and integration guides for building with Glean.",
        },
      },
    },
    codex: {
      outDir: "dist/codex",
      repositoryFiles: "overrides/codex/root",
      manifest: {
        name: "glean-codex-plugins",
        interface: { displayName: "Glean for Codex" },
      },
      plugins: {
        glean: {
          source: "shared/glean",
          overrides: "overrides/codex/glean",
          description: gleanPluginDescription,
          manifest: { interface: gleanCodexInterface },
          entry: codexEntry,
        },
        "glean-dev-docs": {
          source: "shared/glean-dev-docs",
          overrides: "overrides/codex/glean-dev-docs",
          include: ["skills", "assets", "static"],
          description: devDocsDescription,
          manifest: {
            homepage: "https://developers.glean.com/",
            interface: devDocsCodexInterface,
          },
          entry: codexEntry,
        },
      },
    },
    // One Agent Plugins package per plugin, published to gleanwork/glean-plugins
    // with a marketplace for each listed client.
    "agent-plugins": {
      outDir: "dist/agent-plugins",
      repositoryFiles: "overrides/agent-plugins/root",
      clients: {
        codex: { manifest: { interface: { displayName: "Glean" } } },
        copilot: {},
      },
      plugins: {
        glean: {
          source: "shared/glean",
          overrides: "overrides/agent-plugins/glean",
          description: gleanPluginDescription,
          manifest: {
            extensions: { "com.openai": { interface: gleanCodexInterface } },
          },
          clients: { codex: { entry: codexEntry } },
        },
        "glean-dev-docs": {
          source: "shared/glean-dev-docs",
          overrides: "overrides/agent-plugins/glean-dev-docs",
          include: ["skills", "assets", "static"],
          description: devDocsDescription,
          manifest: {
            homepage: "https://developers.glean.com/",
            extensions: { "com.openai": { interface: devDocsCodexInterface } },
          },
          clients: { codex: { entry: codexEntry } },
        },
      },
    },
  },
});
