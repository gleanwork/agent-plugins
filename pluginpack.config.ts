import { readFileSync } from "node:fs";
import { defineConfig } from "@gleanwork/pluginpack";

type Marketplace = {
  name: string;
  version: string;
  description?: string;
  owner?: {
    name: string;
    email?: string;
  };
  metadata?: Record<string, unknown>;
  plugins: Array<{
    name: string;
    source: string;
    description?: string;
  }>;
};

type PluginManifest = Record<string, unknown> & {
  name: string;
  description?: string;
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
}

const claudeMarketplace = readJson<Marketplace>(
  "./.claude-plugin/marketplace.json",
);
const cursorMarketplace = readJson<Marketplace>(
  "./.cursor-plugin/marketplace.json",
);
const cursorPlugin = readJson<PluginManifest>(
  "./sources/cursor-glean/.cursor-plugin/plugin.json",
);

function claudePlugin(name: string) {
  const manifest = readJson<PluginManifest>(
    `./sources/claude-${name}/.claude-plugin/plugin.json`,
  );
  const entry = claudeMarketplace.plugins.find((plugin) => plugin.name === name);
  if (!entry) {
    throw new Error(`Missing Claude marketplace entry for ${name}.`);
  }
  return {
    from: [`claude-${name}`],
    path: `plugins/${name}`,
    description: entry.description,
    manifest,
  };
}

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
    owner: {
      name: "Glean",
      email: "steve.calvert@glean.com",
    },
  },
  targets: {
    claude: {
      outDir: ".",
      plugins: Object.fromEntries(
        claudeMarketplace.plugins.map((plugin) => [
          plugin.name,
          claudePlugin(plugin.name),
        ]),
      ),
      manifest: claudeMarketplace,
    },
    cursor: {
      outDir: ".",
      plugins: {
        glean: {
          from: ["cursor-glean", "cursor-skills"],
          components: ["skills", "agents", "rules"],
          description: cursorMarketplace.plugins[0]?.description,
          manifest: cursorPlugin,
        },
      },
      manifest: cursorMarketplace,
    },
  },
});
