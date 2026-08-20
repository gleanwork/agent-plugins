// Build the plugin's MCP server into a single-file ESM bundle.
//
// Why bundle: Cowork's plugin-install validator rejects zip entries whose
// paths contain `@`, which appears in every scoped npm package's directory
// name (`node_modules/@modelcontextprotocol/...`). Inlining every dependency
// into one dist/index.js means the shipped tree has no scoped-package paths.

import { build } from "esbuild";
import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

const VERSION_FILES = [
  "package.json",
  "shared/glean/mcp/package.json",
];
const SEMVER_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function pluginVersionFromPackages() {
  const found = VERSION_FILES.map((file) => {
    let raw;
    try {
      raw = JSON.parse(readFileSync(file, "utf-8"));
    } catch (err) {
      throw new Error(`build: cannot read ${file}: ${err.message}`);
    }
    const version = raw.version;
    if (typeof version !== "string" || !SEMVER_RE.test(version)) {
      throw new Error(
        `build: ${file} must declare a plain x.y.z version, got ${JSON.stringify(version)}`,
      );
    }
    return { file, version };
  });

  const versions = [...new Set(found.map((entry) => entry.version))];
  if (versions.length !== 1) {
    throw new Error(
      `build: package versions disagree, so there is no single version to bake in:\n` +
        found.map((entry) => `  ${entry.version}  ${entry.file}`).join("\n"),
    );
  }
  return versions[0];
}

const pluginVersion = pluginVersionFromPackages();
const OUTFILE = "shared/glean/mcp/dist/index.js";

await build({
  entryPoints: ["shared/glean/mcp/src/index.ts"],
  outfile: OUTFILE,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  define: {
    __GLEAN_PLUGIN_VERSION__: JSON.stringify(pluginVersion),
  },
  // Not setting `packages` — the default with bundle:true inlines every
  // non-external import, which is exactly what the shipped single-file server
  // needs.
  external: nodeBuiltins,
  // Some transitive deps ship CJS that requires node:* at module-eval time.
  // Provide a working require shim inside the ESM bundle for those builtins.
  banner: {
    js: `import { createRequire as __glean_createRequire } from "node:module";\nconst require = __glean_createRequire(import.meta.url);`,
  },
  minify: false,
  legalComments: "linked",
  logLevel: "info",
  conditions: ["import", "node", "default"],
  mainFields: ["module", "main"],
});

const bundled = readFileSync(OUTFILE, "utf-8");
if (bundled.includes("__GLEAN_PLUGIN_VERSION__")) {
  throw new Error(
    `build: ${OUTFILE} still contains __GLEAN_PLUGIN_VERSION__; esbuild did not substitute it`,
  );
}
if (!bundled.includes(JSON.stringify(pluginVersion))) {
  throw new Error(
    `build: ${OUTFILE} does not contain the version literal ${JSON.stringify(pluginVersion)}`,
  );
}
console.log(`Baked plugin version ${pluginVersion} into ${OUTFILE}`);
