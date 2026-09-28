import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const PERMISSION_CONTEXT_ARG = "_glean_permission_context";
const DIR = "glean-bypass-receipts";
const TTL_MS = 5 * 60_000;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const TOKEN = new RegExp(`^${UUID}$`, "i");
const OWN_FILE = new RegExp(`^${UUID}\\.(json|claimed)$`, "i");

export function stripPermissionContext(args) {
  const clean = { ...args };
  delete clean[PERMISSION_CONTEXT_ARG];
  return clean;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

function fingerprint(args) {
  return createHash("sha256").update(JSON.stringify(canonical(stripPermissionContext(args)))).digest("hex");
}

function privateStat(stat) {
  // Windows uses the user-profile directory's ACLs, not Unix ownership/mode bits.
  return typeof process.getuid !== "function" ||
    ((stat.mode & 0o077) === 0 && stat.uid === process.getuid());
}

function receiptDir(baseDir, create = false) {
  if (create) fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(baseDir).isDirectory()) throw new Error("Invalid receipt base directory");
  const dir = path.join(baseDir, DIR);
  if (create) {
    try { fs.mkdirSync(dir, { mode: 0o700 }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || !privateStat(stat)) throw new Error("Invalid receipt directory");
  return dir;
}

export function createBypassReceipt(baseDir, toolName, args) {
  const body = JSON.stringify({ toolName, fingerprint: fingerprint(args), ts: Date.now() });
  if (Buffer.byteLength(body) > 4096) throw new Error("Receipt too large");
  const token = randomUUID();
  const file = path.join(receiptDir(baseDir, true), `${token}.json`);
  const fd = fs.openSync(file, "wx", 0o600);
  try {
    fs.writeFileSync(fd, body);
  } catch (error) {
    fs.unlinkSync(file);
    throw error;
  } finally {
    fs.closeSync(fd);
  }
  return token;
}

export function consumeBypassReceipt(baseDir, token, toolName, args) {
  if (typeof token !== "string" || !TOKEN.test(token)) return false;
  let claimed;
  let fd;
  try {
    const dir = receiptDir(baseDir);
    const file = path.join(dir, `${token}.json`);
    if (!fs.lstatSync(file).isFile()) return false;
    const target = path.join(dir, `${randomUUID()}.claimed`);
    // Claim before reading: only one consumer can rename the source file.
    fs.renameSync(file, target);
    claimed = target;
    fd = fs.openSync(claimed, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || !privateStat(stat) || stat.nlink !== 1 || stat.size > 4096) return false;
    const buffer = Buffer.alloc(4097);
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (length > 4096) return false;
    const receipt = JSON.parse(buffer.toString("utf8", 0, length));
    const now = Date.now();
    return Number.isSafeInteger(receipt?.ts) && receipt.ts > 0 &&
      receipt.ts <= now && now - receipt.ts < TTL_MS &&
      receipt.toolName === toolName && receipt.fingerprint === fingerprint(args);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* Best-effort close. */ } }
    if (claimed) { try { fs.unlinkSync(claimed); } catch { /* Already cleaned. */ } }
  }
}

export function cleanupBypassReceipts(baseDir) {
  let handle;
  try {
    const dir = receiptDir(baseDir);
    handle = fs.opendirSync(dir);
    const cutoff = Date.now() - TTL_MS;
    // Bound startup work, including unrelated entries. Never follow links.
    for (let i = 0; i < 128; i++) {
      const entry = handle.readSync();
      if (!entry) break;
      if (!OWN_FILE.test(entry.name) || !entry.isFile()) continue;
      try {
        const file = path.join(dir, entry.name);
        const stat = fs.lstatSync(file);
        if (stat.isFile() && privateStat(stat) && stat.nlink === 1 && stat.mtimeMs < cutoff) fs.unlinkSync(file);
      } catch { /* A concurrent consumer may have claimed it. */ }
    }
  } catch { /* Missing or unsafe directories need no cleanup. */ }
  finally { if (handle) { try { handle.closeSync(); } catch { /* Best-effort close. */ } } }
}
