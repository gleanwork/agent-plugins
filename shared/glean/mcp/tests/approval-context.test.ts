import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PERMISSION_CONTEXT_ARG as KEY, stripPermissionContext, createBypassReceipt,
  consumeBypassReceipt, cleanupBypassReceipts } from "../approval-context.mjs";

let base: string;
const args = { server_id: "one", tool_name: "write", arguments: { body: "secret body", list: [1, 2] } };
const dir = () => path.join(base, "glean-bypass-receipts");
const receipt = (token: string) => path.join(dir(), `${token}.json`);
const create = () => createBypassReceipt(base, "run_tool", args);
const consume = (token: unknown, input = args, tool = "run_tool") => consumeBypassReceipt(base, token, tool, input);
beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), "approval-context-")); });
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

describe("bypass receipts", () => {
  it("strips only the top-level context without mutating the caller", () => {
    const original = { ...args, [KEY]: "forged" };
    const clean = stripPermissionContext(original);
    expect(clean).toEqual(args);
    expect(clean).not.toBe(original);
    expect(clean.arguments).toBe(args.arguments);
    expect(original[KEY]).toBe("forged");
  });
  it("stores only tool identity, a SHA256 fingerprint, and timestamp in private files", () => {
    const token = create();
    expect(token).toMatch(/^[\da-f-]{36}$/);
    const body = JSON.parse(fs.readFileSync(receipt(token), "utf8"));
    expect(Object.keys(body).sort()).toEqual(["fingerprint", "toolName", "ts"]);
    expect(body.fingerprint).toMatch(/^[\da-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain("secret body");
    expect(fs.statSync(receipt(token)).mode & 0o777).toBe(0o600);
    expect(fs.statSync(dir()).mode & 0o777).toBe(0o700);
  });
  it("canonicalizes nested object keys, excludes context, and consumes only once", () => {
    const token = createBypassReceipt(base, "run_tool", { ...args, [KEY]: "old" });
    const reordered = { arguments: { list: [1, 2], body: "secret body" }, tool_name: "write", server_id: "one", [KEY]: token };
    expect(consume(token, reordered)).toBe(true);
    expect(consume(token)).toBe(false);
    expect(fs.readdirSync(dir())).toEqual([]);
  });
  it.each(["tool", "server", "remote-tool", "extra", "arguments", "array-order"])("rejects and burns a receipt with mismatched %s", (field) => {
    const token = create();
    const input = structuredClone(args);
    if (field === "server") input.server_id = "two";
    if (field === "remote-tool") input.tool_name = "other";
    if (field === "extra") (input as Record<string, unknown>).extra = true;
    if (field === "arguments") input.arguments.body = "changed";
    if (field === "array-order") input.arguments.list.reverse();
    expect(consume(token, input, field === "tool" ? "other" : "run_tool")).toBe(false);
    expect(consume(token)).toBe(false);
    expect(fs.readdirSync(dir())).toEqual([]);
  });
  it.each([undefined, null, {}, "", "../escape", "../../outside.json", `${randomUUID()}.json`, randomUUID()])(
    "rejects invalid or missing receipt %j", (token) => {
      expect(consume(token)).toBe(false);
      expect(fs.existsSync(dir())).toBe(false);
    },
  );
  it.each(["expired", "future", "string", "negative", "missing"])("rejects %s timestamps", (type) => {
    const token = create();
    const body = JSON.parse(fs.readFileSync(receipt(token), "utf8"));
    body.ts = { expired: Date.now() - 300_001, future: Date.now() + 60_000,
      string: String(Date.now()), negative: -1, missing: undefined }[type];
    fs.writeFileSync(receipt(token), JSON.stringify(body));
    expect(consume(token)).toBe(false);
    expect(fs.readdirSync(dir())).toEqual([]);
  });
  it.each(["{", "null", "{}", "x".repeat(4097)])("rejects malformed or oversized receipt %#", (body) => {
    const token = create();
    fs.writeFileSync(receipt(token), body);
    expect(consume(token)).toBe(false);
    expect(fs.readdirSync(dir())).toEqual([]);
  });
  it("rejects receipt symlinks without touching their targets", () => {
    const token = create();
    const target = path.join(base, "target");
    fs.renameSync(receipt(token), target);
    fs.symlinkSync(target, receipt(token));
    expect(consume(token)).toBe(false);
    cleanupBypassReceipts(base);
    expect(fs.lstatSync(receipt(token)).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(target)).toBe(true);
  });
  it.each(["base", "directory"])("rejects a symlinked %s", (kind) => {
    const target = path.join(base, "target");
    fs.mkdirSync(target, { mode: 0o700 });
    const link = kind === "base" ? path.join(base, "linked-base") : dir();
    fs.symlinkSync(target, link);
    const location = kind === "base" ? link : base;
    expect(() => createBypassReceipt(location, "run_tool", args)).toThrow();
    expect(consumeBypassReceipt(location, randomUUID(), "run_tool", args)).toBe(false);
    cleanupBypassReceipts(location);
    expect(fs.readdirSync(target)).toEqual([]);
  });
  it("rejects non-private receipt files and directories", () => {
    const token = create();
    fs.chmodSync(receipt(token), 0o644);
    expect(consume(token)).toBe(false);
    fs.chmodSync(dir(), 0o755);
    expect(() => create()).toThrow();
  });
  it("allows exactly one concurrent process to consume", async () => {
    const token = create();
    const script = `import { consumeBypassReceipt } from ${JSON.stringify(new URL("../approval-context.mjs", import.meta.url).href)};
      console.log(consumeBypassReceipt(process.argv[1], process.argv[2], "run_tool", ${JSON.stringify(args)}));`;
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      promisify(execFile)(process.execPath, ["--input-type=module", "-e", script, base, token], { timeout: 5000 })));
    expect(results.filter(({ stdout }) => stdout.trim() === "true")).toHaveLength(1);
    expect(fs.readdirSync(dir())).toEqual([]);
  });
  it("cleans only its stale UUID receipt/claim files, not fresh or unrelated entries", () => {
    const fresh = receipt(create());
    const stale = receipt(create());
    const claimed = path.join(dir(), `${randomUUID()}.claimed`);
    const unrelated = path.join(dir(), "preferences.json");
    for (const file of [claimed, unrelated]) fs.writeFileSync(file, "{}", { mode: 0o600 });
    const old = new Date(Date.now() - 600_000);
    for (const file of [stale, claimed, unrelated]) fs.utimesSync(file, old, old);
    cleanupBypassReceipts(base);
    expect(fs.readdirSync(dir()).sort()).toEqual([path.basename(fresh), "preferences.json"].sort());
  });
  it("bounds cleanup work and tolerates missing directories", () => {
    cleanupBypassReceipts(base);
    create();
    const old = new Date(Date.now() - 600_000);
    for (let i = 0; i < 140; i++) {
      const file = receipt(randomUUID());
      fs.writeFileSync(file, "{}", { mode: 0o600 });
      fs.utimesSync(file, old, old);
    }
    cleanupBypassReceipts(base);
    expect(fs.readdirSync(dir()).length).toBeGreaterThanOrEqual(13);
  });
});
