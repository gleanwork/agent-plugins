/**
 * Reads the top-level string fields of a SKILL.md frontmatter block.
 *
 * This replaces `yaml.parse`, which added about 260 KB to dist/index.js for the
 * two fields the plugin reads (`name` and `description`). It handles the YAML
 * forms a skill file uses for a string field:
 *
 * - plain values, including values that continue on indented lines
 * - single- and double-quoted values, including escapes and multi-line values
 * - literal (`|`) and folded (`>`) block scalars, with chomping (`-`, `+`) and
 *   indentation indicators
 * - comments
 *
 * A field whose value isn't a string (a map, a list, a number, a boolean, or
 * null) is left out, as before. Input that YAML rejects, such as a duplicate key
 * or an unterminated quote, returns `{}`, so callers fall back to their defaults
 * exactly as they did when `yaml.parse` threw. tests/frontmatter.test.ts checks
 * these results against the `yaml` package.
 *
 * Out of scope, because skill files don't use them for these fields: anchors,
 * aliases, tags, flow collections as values (`[a, b]`, `{a: b}`), quoted keys,
 * and multiple documents. A field that uses one of them is left out.
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  try {
    return parseTopLevel(match[1].split(/\r?\n/));
  } catch (err) {
    if (err instanceof FrontmatterError) return {};
    throw err;
  }
}

/** Input that a YAML parser rejects. The whole frontmatter is then unreadable. */
class FrontmatterError extends Error {}

const KEY_LINE = /^([^\s#:'"\-?[\]{},&*!|>%@`][^:#]*?|-[^\s:#][^:#]*?)[ \t]*:(?:[ \t]+(.*))?$/;

function parseTopLevel(rawLines: string[]): Record<string, string> {
  const lines = dedentTopLevel(rawLines);
  const result: Record<string, string> = {};
  const seen = new Set<string>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line) || isCommentLine(line)) {
      i++;
      continue;
    }
    if (/^[ \t]/.test(line)) {
      // An indented line here doesn't belong to any key.
      throw new FrontmatterError("unexpected indentation");
    }
    const keyMatch = line.match(KEY_LINE);
    if (!keyMatch) {
      // A top-level list, a bare scalar, or a key form this reader doesn't
      // support. yaml.parse would either reject it or not give a map of strings.
      throw new FrontmatterError(`unsupported line: ${line}`);
    }
    const key = keyMatch[1];
    if (seen.has(key)) throw new FrontmatterError(`duplicate key: ${key}`);
    // Checked below, once the value's lines are known: YAML doesn't allow tabs
    // as indentation.
    seen.add(key);

    // The value's continuation: every following line that is blank, a comment,
    // or indented. A key with no inline value may also hold a list written at
    // the key's own indentation ("key:\n- a\n- b").
    const inline = keyMatch[2] ?? "";
    const listAllowed = inline.trim() === "" || inline.trimStart().startsWith("#");
    let end = i + 1;
    while (
      end < lines.length &&
      (isBlank(lines[end]) ||
        /^[ \t]/.test(lines[end]) ||
        isCommentLine(lines[end]) ||
        (listAllowed && /^-([ \t]|$)/.test(lines[end])))
    ) {
      end++;
    }
    const block = lines.slice(i + 1, end);
    if (block.some((line) => line.startsWith("\t") && !isBlank(line))) {
      throw new FrontmatterError("tab indentation");
    }
    const value = readValue(inline, block);
    if (value !== undefined) result[key] = value;
    i = end;
  }
  return result;
}

/**
 * YAML accepts a top-level map that is indented as a whole. Remove that shared
 * indentation, taken from the first line with content.
 */
function dedentTopLevel(lines: string[]): string[] {
  const first = lines.find((line) => !isBlank(line) && !isCommentLine(line));
  if (first === undefined) return lines;
  const indent = first.length - first.trimStart().length;
  if (indent === 0) return lines;
  if (/^ *\t/.test(first)) throw new FrontmatterError("tab indentation");
  return lines.map((line) => {
    if (isBlank(line) || isCommentLine(line)) return line.trimStart();
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent < indent) throw new FrontmatterError("line is indented less than the map");
    return line.slice(indent);
  });
}

/** Returns the field's string value, or undefined when it isn't a string. */
function readValue(inline: string, block: string[]): string | undefined {
  const first = inline.trimEnd();
  if (first.startsWith("|") || first.startsWith(">")) return readBlockScalar(first, block);
  if (first.startsWith('"')) return readQuoted(first, block, '"');
  if (first.startsWith("'")) return readQuoted(first, block, "'");
  if (first === "" || first.startsWith("#")) {
    const content = block.filter((line) => !isBlank(line) && !isCommentLine(line));
    if (content.length === 0) return undefined; // null
    const head = content[0].trim();
    // A nested list or map, which is not a string.
    if (/^-([ \t]|$)/.test(head) || KEY_LINE.test(head)) return undefined;
    // A quoted value on the next line.
    if (head.startsWith('"') || head.startsWith("'")) {
      const start = block.findIndex((line) => line.trim() === head);
      return readQuoted(head, block.slice(start + 1), head[0] as '"' | "'");
    }
    // A block scalar or anything else this reader doesn't handle on the next
    // line is left out.
    if (/^[|>[{&*!%@`]/.test(head)) return undefined;
    return readPlain("", block);
  }
  // A flow collection closed on its own line can't be followed by more content.
  // One that continues on later lines is left out, like the forms below.
  if (/^[[{]/.test(first) && /[\]}]$/.test(stripPlainComment(first).text.trimEnd())) {
    if (block.some((line) => !isBlank(line) && !isCommentLine(line))) {
      throw new FrontmatterError("content after a flow collection");
    }
    return undefined;
  }
  // Anchors, aliases, tags, flow collections and reserved indicators.
  if (/^[[{&*!%@`]/.test(first)) return undefined;
  return readPlain(first, block);
}

function readPlain(firstLine: string, block: string[]): string | undefined {
  const parts: string[] = [];
  let emptyLines = 0;
  let ended = false;

  const add = (raw: string): void => {
    const { text, hadComment } = stripPlainComment(raw);
    const trimmed = text.trim();
    if (/:([ \t]|$)/.test(trimmed)) {
      throw new FrontmatterError("a plain value can't contain ': '");
    }
    if (trimmed !== "") {
      if (parts.length > 0) parts.push(emptyLines === 0 ? " " : "\n".repeat(emptyLines));
      parts.push(trimmed);
      emptyLines = 0;
    }
    if (hadComment) ended = true;
  };

  if (firstLine !== "") add(firstLine);
  for (const line of block) {
    if (isBlank(line)) {
      if (parts.length > 0) emptyLines++;
      continue;
    }
    if (isCommentLine(line)) {
      // A comment ends a plain value, unless the value hasn't started yet.
      if (parts.length > 0) ended = true;
      continue;
    }
    if (ended) throw new FrontmatterError("content after a comment");
    if (line.startsWith("-")) throw new FrontmatterError("list item inside a plain value");
    add(line);
  }

  const value = parts.join("");
  return isCoreSchemaNonString(value) ? undefined : value;
}

/** Splits off a ` #` comment. In a plain value, `#` starts one only after whitespace. */
function stripPlainComment(raw: string): { text: string; hadComment: boolean } {
  const m = raw.match(/(^|[ \t])#/);
  if (!m || m.index === undefined) return { text: raw, hadComment: false };
  return { text: raw.slice(0, m.index), hadComment: true };
}

/** YAML 1.2 core schema: these plain values are null, booleans or numbers. */
function isCoreSchemaNonString(value: string): boolean {
  return (
    /^(~|null|Null|NULL)?$/.test(value) ||
    /^(true|True|TRUE|false|False|FALSE)$/.test(value) ||
    /^[-+]?[0-9]+$/.test(value) ||
    /^0o[0-7]+$/.test(value) ||
    /^0x[0-9a-fA-F]+$/.test(value) ||
    /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(value) ||
    /^[-+]?\.(inf|Inf|INF)$/.test(value) ||
    /^\.(nan|NaN|NAN)$/.test(value)
  );
}

const DOUBLE_QUOTE_ESCAPES: Record<string, string> = {
  "0": "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  "\t": "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\u0085",
  _: "\u00a0",
  L: "\u2028",
  P: "\u2029",
};

function readQuoted(first: string, block: string[], quote: '"' | "'"): string {
  const text = [first, ...block].join("\n");
  let out = "";
  let pendingSpace = ""; // raw whitespace, dropped if a line break follows
  let i = 1;
  for (;;) {
    if (i >= text.length) throw new FrontmatterError("unterminated quoted value");
    const ch = text[i];
    if (ch === quote) {
      if (quote === "'" && text[i + 1] === "'") {
        out += pendingSpace + "'";
        pendingSpace = "";
        i += 2;
        continue;
      }
      out += pendingSpace;
      i++;
      break;
    }
    if (ch === " " || ch === "\t") {
      pendingSpace += ch;
      i++;
      continue;
    }
    if (ch === "\n") {
      // Fold: one line break becomes a space, and n blank lines become n line
      // breaks. Whitespace around the break is dropped.
      pendingSpace = "";
      let breaks = 0;
      while (text[i] === "\n") {
        breaks++;
        i++;
        while (text[i] === " " || text[i] === "\t") i++;
      }
      out += breaks === 1 ? " " : "\n".repeat(breaks - 1);
      continue;
    }
    if (quote === '"' && ch === "\\") {
      out += pendingSpace;
      pendingSpace = "";
      const next = text[i + 1];
      if (next === "\n") {
        // An escaped line break joins the lines with nothing between them.
        i += 2;
        while (text[i] === " " || text[i] === "\t") i++;
        continue;
      }
      const hexLength = next === "x" ? 2 : next === "u" ? 4 : next === "U" ? 8 : 0;
      if (hexLength > 0) {
        const hex = text.slice(i + 2, i + 2 + hexLength);
        if (!new RegExp(`^[0-9a-fA-F]{${hexLength}}$`).test(hex)) {
          throw new FrontmatterError("bad escape");
        }
        out += String.fromCodePoint(parseInt(hex, 16));
        i += 2 + hexLength;
        continue;
      }
      if (next === undefined || !(next in DOUBLE_QUOTE_ESCAPES)) {
        throw new FrontmatterError("bad escape");
      }
      out += DOUBLE_QUOTE_ESCAPES[next];
      i += 2;
      continue;
    }
    out += pendingSpace + ch;
    pendingSpace = "";
    i++;
  }
  // Only whitespace or a comment may follow the closing quote.
  const rest = text.slice(i);
  if (!/^([ \t]*([ \t]#[^\n]*)?)(\n[ \t]*(#[^\n]*)?)*[ \t]*$/.test(rest)) {
    throw new FrontmatterError("content after a quoted value");
  }
  return out;
}

function readBlockScalar(header: string, block: string[]): string {
  const m = header.match(/^([|>])(?:([1-9])([-+])?|([-+])([1-9])?)?(?:[ \t]+#.*)?$/);
  if (!m) throw new FrontmatterError(`bad block scalar header: ${header}`);
  const folded = m[1] === ">";
  const explicitIndent = Number(m[2] ?? m[5] ?? 0);
  const chomping = m[3] ?? m[4] ?? "";

  // The block's content is indented under the top-level key. A line at column
  // 0 (here, only a comment, since the caller stops at the next key) ends it,
  // and content after that is an error.
  const stop = block.findIndex((line) => !isBlank(line) && !/^[ \t]/.test(line));
  const body = stop === -1 ? block : block.slice(0, stop);
  if (stop !== -1 && block.slice(stop).some((line) => !isBlank(line) && !isCommentLine(line))) {
    throw new FrontmatterError("block scalar content after a comment");
  }

  let indent = explicitIndent;
  if (indent === 0) {
    const firstContent = body.find((line) => !isBlank(line));
    indent = firstContent === undefined ? 0 : firstContent.length - firstContent.trimStart().length;
  }

  const lines: string[] = [];
  for (const [n, line] of body.entries()) {
    if (isBlank(line)) {
      lines.push("");
      continue;
    }
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent < indent) {
      // A comment indented less than the content ends the block, if only blank
      // lines and comments follow it.
      const rest = body.slice(n);
      if (isCommentLine(line) && rest.every((l) => isBlank(l) || isCommentLine(l))) break;
      throw new FrontmatterError("block scalar line is indented too little");
    }
    lines.push(line.slice(indent));
  }

  // Leading blank lines are content; trailing blank lines are subject to chomping.
  let lastContent = lines.length - 1;
  while (lastContent >= 0 && lines[lastContent] === "") lastContent--;
  const content = lines.slice(0, lastContent + 1);
  const trailingBlank = lines.length - content.length;

  let out = "";
  let emptyLines = 0;
  let readContent = false;
  let atMoreIndented = false;
  for (const line of content) {
    if (line === "") {
      emptyLines++;
      continue;
    }
    if (!folded) {
      out += "\n".repeat(readContent ? emptyLines + 1 : emptyLines);
    } else if (/^[ \t]/.test(line)) {
      // More-indented lines keep their line breaks.
      atMoreIndented = true;
      out += "\n".repeat(readContent ? emptyLines + 1 : emptyLines);
    } else if (atMoreIndented) {
      atMoreIndented = false;
      out += "\n".repeat(emptyLines + 1);
    } else if (emptyLines === 0) {
      if (readContent) out += " ";
    } else {
      out += "\n".repeat(emptyLines);
    }
    out += line;
    readContent = true;
    emptyLines = 0;
  }

  if (chomping === "-") return out;
  if (chomping === "+") {
    if (!readContent) return "";
    return out + "\n" + "\n".repeat(trailingBlank);
  }
  return readContent ? out + "\n" : "";
}

function isBlank(line: string): boolean {
  return /^[ \t]*$/.test(line);
}

function isCommentLine(line: string): boolean {
  return /^[ \t]*#/.test(line);
}
