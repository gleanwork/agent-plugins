import { describe, expect, it } from "vitest";
import yaml from "yaml";
import { parseFrontmatter } from "../src/frontmatter.js";

/**
 * The implementation parseFrontmatter replaced. `yaml` is a dev dependency only,
 * so the shipped bundle doesn't include it; these tests hold the replacement to
 * the same results.
 */
function yamlReference(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  try {
    const parsed = yaml.parse(match[1]);
    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") result[key] = value;
      }
    }
  } catch {
    return {};
  }
  return result;
}

const doc = (body: string) => `---\n${body}\n---\n# Skill\n`;

// Each body is the text between the --- delimiters.
const bodies: Record<string, string> = {
  "plain fields": "name: search-jira\ndescription: Search Jira issues",
  "nested map is ignored": "name: gcal\ndescription: Create events\nmetadata:\n  author: glean\n  tags: [a, b]",
  "nested list is ignored": "name: x\nallowed-tools:\n  - Read\n  - Bash\ndescription: d",
  "dash list at key indentation": "name: x\nlist:\n- a\n- b\ndescription: d",
  "long plain value with punctuation":
    "name: gmailnative-default\ndescription: Gmail email — common jobs like draft an email, reply to a message, summarize my inbox. Use when the user asks (e.g. \"catch up\").",
  "url in plain value": "name: x\ndescription: See https://developers.glean.com/docs?a=1#frag for details",
  "hash without space is content": "name: x\ndescription: C# and F#",
  "trailing comment": "name: x # the name\ndescription: d   # trailing",
  "comment lines": "# leading comment\nname: x\n# between\ndescription: d\n# trailing",
  "value on next line": "name: next-line\ndescription:\n  The value on next line",
  "plain multi-line folds": "name: x\ndescription: first part\n  second part\n  third part",
  "plain multi-line with blank line": "name: x\ndescription: para one\n  still one\n\n  para two",
  "plain multi-line ends at comment": "name: x\ndescription: one\n  two\n  # note\nother: y",
  "folded block": "name: x\ndescription: >\n  This is a long description\n  spanning multiple lines",
  "folded block strip": "name: x\ndescription: >-\n  one\n  two",
  "folded block keep": "name: x\ndescription: >+\n  one\n  two\n\n\nnext: y",
  "folded block with paragraphs": "name: x\ndescription: >\n  para one\n  continues\n\n  para two\n\n\n  para three",
  "folded block with more-indented lines": "name: x\ndescription: >\n  intro\n    code line\n    code line 2\n  outro\n  more",
  "literal block": "name: x\ndescription: |\n  Line one\n  Line two",
  "literal block strip": "name: x\ndescription: |-\n  Line one\n  Line two\n\n",
  "literal block keep": "name: x\ndescription: |+\n  Line one\n\n\nname2: y",
  "literal block keeps inner indentation": "name: x\ndescription: |\n  - item\n    nested: yes\n  # not a comment\n  end",
  "literal block with leading blank line": "name: x\ndescription: |\n\n  after blank",
  "block with explicit indentation": "name: x\ndescription: |2\n    four spaces\n  two spaces",
  "block header with comment": "name: x\ndescription: > # folded\n  text",
  "block followed by key": "description: |\n  body\nname: after",
  "empty block": "name: x\ndescription: |\nother: y",
  "single-quoted": "name: 'quoted name'\ndescription: 'It''s here: with colon # and hash'",
  "double-quoted with escapes": 'name: "x"\ndescription: "Tab\\there, quote \\" and \\\\ backslash, \\u00e9, \\x41"',
  "double-quoted multi-line": 'name: x\ndescription: "first\n  second\n\n  third"',
  "double-quoted escaped line break": 'name: x\ndescription: "join\\\n  ed"',
  "single-quoted multi-line": "name: x\ndescription: 'one\n  two'",
  "quoted with trailing comment": 'name: "x" # c\ndescription: \'d\'   # c',
  "colon in plain value is an error": "name: x\ndescription: Use when: something happens",
  "trailing colon is an error": "name: x\ndescription: ends with colon:",
  "duplicate key is an error": "name: a\nname: b\ndescription: d",
  "unterminated quote is an error": 'name: "x\ndescription: d',
  "content after quote is an error": 'name: "x" y\ndescription: d',
  "bad escape is an error": 'name: x\ndescription: "bad \\q escape"',
  "number is not a string": "name: 123\ndescription: 1.5",
  "booleans and null are not strings": "name: true\ndescription: null\nother: ~\nflag: False",
  "hex and octal are not strings": "name: 0x1F\ndescription: 0o17",
  "inf and nan are not strings": "name: .inf\ndescription: .NaN",
  "number-like strings stay strings": "name: 1.2.3\ndescription: 12abc\nversion: v1",
  "quoted numbers are strings": "name: '123'\ndescription: \"true\"",
  "empty value is null": "name:\ndescription: d",
  "flow sequence is not a string": "name: x\ndescription: [a, b]",
  "flow map is not a string": "name: x\ndescription: {a: b}",
  "keys with dashes and dots": "allowed-tools: Read\nx.y: z\nname: n",
  "dash-prefixed key": "-name: x\ndescription: d",
  "unicode": "name: 検索\ndescription: Résumé — “smart quotes” and emoji 🚀",
  "trailing spaces": "name: x   \ndescription: d \t",
  "spaces before colon": "name   : x\ndescription: d",
  "no space after colon is not a key": "name:x\ndescription: d",
  "bare scalar": "just text",
  "only comments": "# nothing here",
};

describe("parseFrontmatter", () => {
  for (const [label, body] of Object.entries(bodies)) {
    it(`matches yaml.parse: ${label}`, () => {
      const content = doc(body);
      expect(parseFrontmatter(content)).toEqual(yamlReference(content));
    });
  }

  it("matches yaml.parse with CRLF line endings", () => {
    for (const body of Object.values(bodies)) {
      const content = doc(body).replace(/\n/g, "\r\n");
      expect(parseFrontmatter(content)).toEqual(yamlReference(content));
    }
  });

  it("returns {} for a top-level list", () => {
    // yaml.parse returns an array here, which the old code turned into the keys
    // "0" and "1". The skills index reads only name and description, so neither
    // result changes what it shows.
    expect(parseFrontmatter(doc("- a\n- b"))).toEqual({});
  });

  it("returns {} without a frontmatter block", () => {
    expect(parseFrontmatter("# No frontmatter here")).toEqual({});
    expect(parseFrontmatter("name: x\n---\n")).toEqual({});
  });

  it("matches yaml.parse on generated mixes of lines", () => {
    // Random combinations of these lines, valid and invalid YAML alike, with a
    // fixed seed so a failure always reproduces.
    const fragments = [
      "name: x", "name: 'q''s'", 'name: "a\\tb"', "description: plain text", "description: >",
      "description: |", "description: >-", "description: |+", "description:", "  continued line",
      "    more indented", "", "# comment", "  # indented comment", "- item", "  - item", "  key: v",
      "other: y", "description: a # c", "description: C#", "  'quoted'", "description: 'one", "  two'",
      'description: "esc \\u00e9', '  end"', "description: [a]", "flag: true", "n: 12",
      "description: v: w", "x.y: z", "description: |2", "      deep", "  shallow", "description: >\t",
      "\tdescription: tab", "description: tail   ",
    ];
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const mismatches: string[] = [];
    for (let n = 0; n < 3000; n++) {
      const count = 1 + Math.floor(random() * 7);
      const body = Array.from({ length: count }, () => fragments[Math.floor(random() * fragments.length)]).join("\n");
      const content = doc(body);
      const ours = JSON.stringify(parseFrontmatter(content));
      const reference = yamlReference(content);
      // See "returns {} for a top-level list".
      const expected = JSON.stringify(Object.keys(reference).every((k) => /^\d+$/.test(k)) ? {} : reference);
      if (ours !== expected) mismatches.push(JSON.stringify(body));
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it("reads the fields the skills index uses", () => {
    expect(parseFrontmatter(doc("name: search-jira\ndescription: >-\n  Search Jira\n  issues"))).toEqual({
      name: "search-jira",
      description: "Search Jira issues",
    });
  });
});
