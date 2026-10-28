// Build the plugin's MCP server into a single-file ESM bundle.
//
// Why bundle: Cowork's plugin-install validator rejects zip entries whose
// paths contain `@`, which appears in every scoped npm package's directory
// name (`node_modules/@modelcontextprotocol/...`). Inlining every dependency
// into one dist/index.js means the shipped tree has no scoped-package paths.

import { analyzeMetafile, build } from "esbuild";
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

// Anthropic's plugin directory holds a plugin for manual review when its
// security scan can't fully read a file, and a large dist/index.js is one it
// can't read. v3.4.2 passed at 983 KB; v3.6.0 was held at 1.63 MB. Keep the
// bundle under this budget so a release doesn't wait for a reviewer.
const MAX_BUNDLE_BYTES = 950_000;

// Both MCP SDKs default to the ajv JSON Schema validator, and each bundles its
// own copy: about 520 KB together. index.ts and remote-client.ts pass the
// SDKs' cf-worker validator instead, so replace the two modules that construct
// the ajv default with stubs that throw. If a later change drops one of those
// validators, the server fails at startup instead of silently pulling ajv back.
const DEFAULT_VALIDATOR_ERROR =
  "the ajv JSON Schema validator is not bundled; pass jsonSchemaValidator (see build.mjs)";
const defaultValidatorStubs = {
  name: "stub-default-json-schema-validators",
  setup(b) {
    // v1 SDK: server/index.js and client/index.js import AjvJsonSchemaValidator.
    b.onResolve({ filter: /\/validation\/ajv-provider\.js$/ }, (args) =>
      args.importer.includes("node_modules/@modelcontextprotocol/sdk/")
        ? { path: "v1-ajv-provider", namespace: "validator-stub" }
        : undefined,
    );
    // v2 client: index.mjs imports DefaultJsonSchemaValidator from its Node shim.
    b.onResolve({ filter: /^@modelcontextprotocol\/client\/_shims$/ }, () => ({
      path: "v2-client-shims",
      namespace: "validator-stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "validator-stub" }, (args) => {
      const stub = `class Unbundled { constructor() { throw new Error(${JSON.stringify(DEFAULT_VALIDATOR_ERROR)}); } }`;
      const contents =
        args.path === "v1-ajv-provider"
          ? `${stub}\nexport { Unbundled as AjvJsonSchemaValidator };`
          : // Same CORS_IS_POSSIBLE value as the package's own shimsNode.mjs.
            `${stub}\nexport const CORS_IS_POSSIBLE = false;\nexport { Unbundled as DefaultJsonSchemaValidator };`;
      return { contents, loader: "js" };
    });
  },
};

const result = await build({
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
  plugins: [defaultValidatorStubs],
  metafile: true,
});

// BUNDLE_ANALYZE=1 npm run build:bundle lists what takes up the bundle.
if (process.env.BUNDLE_ANALYZE) {
  console.log(await analyzeMetafile(result.metafile, { verbose: false }));
}

const bundledInputs = Object.keys(result.metafile.inputs);
const unwanted = bundledInputs.filter((file) =>
  /node_modules\/(ajv|ajv-formats|yaml)\//.test(file),
);
if (unwanted.length > 0) {
  throw new Error(
    `build: ${OUTFILE} bundles packages that are meant to stay out:\n` +
      unwanted.map((file) => `  ${file}`).join("\n"),
  );
}
const bundleBytes = result.metafile.outputs[OUTFILE].bytes;
if (bundleBytes > MAX_BUNDLE_BYTES) {
  throw new Error(
    `build: ${OUTFILE} is ${bundleBytes} bytes, over the ${MAX_BUNDLE_BYTES}-byte budget. ` +
      "See MAX_BUNDLE_BYTES in build.mjs.",
  );
}

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
console.log(`${OUTFILE}: ${bundleBytes} bytes (budget ${MAX_BUNDLE_BYTES})`);
