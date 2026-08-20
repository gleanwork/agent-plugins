import { describe, it, expect } from "vitest";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pluginVersion, pluginVersionString } from "../src/version.js";

// Anchor to the test file, not cwd — vitest runs with --root shared/glean/mcp
// while the process cwd stays at the repo root.
const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..");
const repoRoot = path.resolve(here, "../../../..");

const readVersion = (manifest: string): string =>
  JSON.parse(readFileSync(manifest, "utf8")).version;

describe("plugin version", () => {
  it("reports unknown when source runs without the build-time define", () => {
    expect(pluginVersion()).toEqual({ version: "0.0.0", source: "unknown" });
    expect(pluginVersionString()).toBe("0.0.0");
  });

  it("stays in step with the repo-root version that release-it bumps", () => {
    // prebuild syncs these; drift means a release would misreport its version.
    expect(readVersion(path.join(serverDir, "package.json"))).toBe(
      readVersion(path.join(repoRoot, "package.json")),
    );
  });

  it("advertises the version over MCP from the built bundle", async () => {
    // The build verifies both package versions, substitutes the constant, and
    // asserts that the literal landed in the emitted bundle.
    execFileSync("node", ["shared/glean/mcp/build.mjs"], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    const staged = mkdtempSync(path.join(tmpdir(), "glean-plugin-layout-"));
    let child: ChildProcessWithoutNullStreams | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      mkdirSync(path.join(staged, "dist"));
      copyFileSync(
        path.join(serverDir, "dist/index.js"),
        path.join(staged, "dist/index.js"),
      );
      copyFileSync(
        path.join(serverDir, "package.json"),
        path.join(staged, "package.json"),
      );

      const server = spawn("node", [path.join(staged, "dist/index.js")], {
        // Keep all server state inside the temp dir — never touch ~/.glean.
        env: {
          ...process.env,
          CLAUDE_PLUGIN_DATA: path.join(staged, "plugin-data"),
          SKILLS_BASE_DIR: path.join(staged, "skills"),
        },
        stdio: "pipe",
      });
      child = server;

      const version = await new Promise<string>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("no initialize response within 15s")),
          15_000,
        );
        createInterface({ input: server.stdout }).on("line", (line) => {
          try {
            const msg = JSON.parse(line);
            if (msg.id === 1 && msg.result?.serverInfo) {
              resolve(msg.result.serverInfo.version);
            }
          } catch {
            // Not a JSON-RPC frame.
          }
        });
        // Fail fast with the server's own diagnostics instead of waiting out
        // the timeout when it dies during startup.
        let stderr = "";
        server.stderr.on("data", (chunk) => (stderr += chunk.toString()));
        server.on("exit", (code) =>
          reject(
            new Error(`server exited (${code}) before replying: ${stderr}`),
          ),
        );
        server.on("error", reject);
        server.stdin.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              clientInfo: { name: "version-test", version: "0.0.0" },
            },
          }) + "\n",
        );
      });

      expect(version).toBe(readVersion(path.join(repoRoot, "package.json")));
    } finally {
      clearTimeout(timer);
      child?.kill();
      rmSync(staged, { recursive: true, force: true });
    }
  }, 30_000);
});
