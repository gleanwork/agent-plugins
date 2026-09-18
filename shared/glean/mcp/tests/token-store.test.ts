import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Mock homedir before importing token-store so it uses a temp directory
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "token-store-test-"));
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => tmpDir };
});

const { clearCredentials, loadCredentials, saveCredentials } =
  await import("../src/token-store.js");

describe("token-store", () => {
  const gleanDir = path.join(tmpDir, ".glean");
  const credFile = path.join(gleanDir, "mcp-credentials.json");

  beforeEach(() => {
    vi.stubEnv("PLUGIN_DATA_DIR", gleanDir);
    fs.rmSync(gleanDir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(gleanDir, { recursive: true, force: true });
  });

  it("returns undefined when credentials file does not exist", () => {
    expect(loadCredentials()).toBeUndefined();
  });

  it("saves and loads credentials round-trip", () => {
    const tokens = { access_token: "tok_123", token_type: "Bearer" };
    const clientInfo = { client_id: "cid_456" };

    saveCredentials(tokens, clientInfo);
    const loaded = loadCredentials();

    expect(loaded).toEqual({ tokens, clientInfo });
  });

  it("creates ~/.glean/ directory on first save", () => {
    expect(fs.existsSync(gleanDir)).toBe(false);

    saveCredentials({ access_token: "x" }, undefined);

    expect(fs.existsSync(gleanDir)).toBe(true);
  });

  it("sets credentials file to mode 0600", () => {
    saveCredentials({ access_token: "x" }, undefined);

    const stat = fs.statSync(credFile);
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("sets the credentials directory to mode 0700", () => {
    fs.mkdirSync(gleanDir, { recursive: true, mode: 0o755 });

    saveCredentials({ access_token: "x" }, undefined);

    expect(fs.statSync(gleanDir).mode & 0o777).toBe(0o700);
  });

  it("tightens a leftover temp file before replacing credentials", () => {
    fs.mkdirSync(gleanDir, { recursive: true });
    const tmpPath = path.join(gleanDir, `.mcp-credentials.json.${process.pid}.tmp`);
    fs.writeFileSync(tmpPath, "stale", { mode: 0o644 });

    saveCredentials({ access_token: "new" }, undefined);

    expect(loadCredentials()?.tokens?.access_token).toBe("new");
    expect(fs.statSync(credFile).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(gleanDir)).toEqual(["mcp-credentials.json"]);
  });

  it("preserves credentials and removes the temp file when rename fails", () => {
    const original = { access_token: "old" };
    saveCredentials(original, { client_id: "cid" });
    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => {
      throw new Error("rename blocked");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => saveCredentials({ access_token: "new" }, undefined)).not.toThrow();

    expect(loadCredentials()).toEqual({ tokens: original, clientInfo: { client_id: "cid" } });
    expect(fs.readdirSync(gleanDir)).toEqual(["mcp-credentials.json"]);
    expect(log).toHaveBeenCalledWith("[auth] Failed to persist credentials: rename blocked");
  });

  it("returns undefined for corrupted JSON", () => {
    fs.mkdirSync(gleanDir, { recursive: true });
    fs.writeFileSync(credFile, "not-json{{{", "utf-8");

    expect(loadCredentials()).toBeUndefined();
  });

  it("overwrites existing credentials on save", () => {
    saveCredentials({ access_token: "old" }, { client_id: "old" });
    saveCredentials({ access_token: "new" }, { client_id: "new" });

    const loaded = loadCredentials();
    expect(loaded).toEqual({
      tokens: { access_token: "new" },
      clientInfo: { client_id: "new" },
    });
  });

  it("clearCredentials removes the persisted file", () => {
    saveCredentials({ access_token: "x" }, { client_id: "y" });
    expect(fs.existsSync(credFile)).toBe(true);

    clearCredentials();

    expect(fs.existsSync(credFile)).toBe(false);
    expect(loadCredentials()).toBeUndefined();
  });

  it("clearCredentials is a no-op when file does not exist", () => {
    expect(fs.existsSync(credFile)).toBe(false);
    expect(() => clearCredentials()).not.toThrow();
  });

});
