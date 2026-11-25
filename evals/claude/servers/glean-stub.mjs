#!/usr/bin/env node
// A stub Glean MCP server for skill evals. It has no dependencies and holds
// only synthetic data (see catalog.mjs), so an eval needs no Glean sign-in and
// its transcripts hold nothing from a real deployment.
//
//   node glean-stub.mjs --shape <shape>     stdio
//
// Shapes are the tool lists a Glean plugin can meet:
//   direct        skill discovery with file names; files come from
//                 read_skill_files. This is what a Glean server offers a
//                 client that connects to it directly.
//   no-discovery  search and read_document only: an admin has not enabled
//                 skill discovery on this server.
//   gateway       what the plugin's local relay talks to: skill discovery
//                 returns every file as one JSON map. Served over HTTP by
//                 relay.mjs, not used on its own.
//   unrelated     one tool that has nothing to do with Glean, for the case
//                 where no Glean server is connected.
import http from "node:http";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import {
  DOCUMENTS,
  DOWNSTREAM_TOOLS,
  EVENTS,
  ISSUES,
  SKILLS,
} from "./catalog.mjs";

export const SHAPES = ["direct", "no-discovery", "gateway", "proxy", "unrelated"];

// The three descriptions below are the ones a Glean server sends, word for
// word, because the glean_run skill tells the model to follow them.
const FIND_SKILLS_DESCRIPTION = `Find the tools and skills needed to complete the user’s task across apps connected to Glean—including capabilities not listed directly. Search for what you need to do, like send email, edit docs like Google Docs, create tickets on Jira, update records or cases in Salesforce, or retrieve information across all possible connected apps to the company. It tells you which tools to use and how to use them, step by step, to complete any task.
Call this tool FIRST, before any other tool, whenever the request involves doing something in another app, when none of the listed tools is an exact fit, or when a search-only tool would not complete the task. The tools listed directly are only a fraction of what is connected; this tool returns the exact tool schemas to invoke with run_tool. Never guess a tool name, and never tell the user a tool or app is unavailable without calling this first.
This is a search engine over skills and their tools: match on the core action, not the full request. Break the request into small, task-atomic queries, keep only the action and drop the surrounding context (recipients, timing, reasons, constraints), and pass each as a separate entry in the 'queries' array. For "Send an email to X for tomorrow's demo meeting as leadership will be visiting", the single query is "send an email".
If a returned skill lists no tools and its playbook does not let you complete the task, first check whether tools already in scope can do it: tools from other skills in this response, tools from earlier find_skills_and_tools calls, or tools you can already call directly. If none fit, call find_skills_and_tools again with reworded or additional queries.

The response lists each matching skill with its files under <files>:
- A <file> with no body (self-closing tag) lives on the server — fetch it with read_skill_files(skill_name, file_paths=["..."]); batch multiple paths into one call.
- A <file> with an inline body (CDATA) is delivered with the response — read it directly, no read_skill_files call needed.
- Files named tools/<TOOL_NAME>.json are the skill's available tools.
To use a returned skill, in order:
(1) Read SKILL.md (if listed) for the playbook — REQUIRED when present; it teaches which tools to invoke, in what sequence, and how to compose them.
(2) For each tool you plan to invoke, read tools/<TOOL_NAME>.json for its exact server_id, name, and inputSchema. If a tool lists "instances" (the same tool backed by several datasource instances, e.g. multiple Jira sites), pick the instance the user means — the one they named, inferred from the conversation/memory when unambiguous, or ask — and pass that instance's server_id; otherwise use the top-level server_id.
(3) Read any other listed files (e.g. examples/, references/) only when they're relevant to the task.
(4) Call run_tool(server_id, tool_name, arguments) with arguments matching the inputSchema exactly. Never guess parameter names.`;

const READ_SKILL_FILES_DESCRIPTION =
  "Read one or more files from a Glean skill returned by a previous find_skills_and_tools call.";

const RUN_TOOL_DESCRIPTION =
  "Execute a tool on a downstream MCP server by server_id and tool_name.";

const QUERIES_SCHEMA = {
  type: "object",
  properties: {
    queries: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3,
      description:
        "One short action per entry, e.g. 'send email', 'send slack message', 'create jira ticket', 'create google doc', 'update spreadsheet', 'schedule meeting', 'update salesforce record', 'open github issue', 'search documents'. Keep only the action; drop recipients, timing, and reasons.",
    },
  },
  required: ["queries"],
};

const RUN_TOOL_SCHEMA = {
  type: "object",
  properties: {
    server_id: {
      type: "string",
      description: "The ID of the downstream MCP server to route the call to.",
    },
    tool_name: {
      type: "string",
      description: "The name of the tool to invoke on the downstream server.",
    },
    arguments: {
      type: "object",
      description:
        "Arguments to pass to the downstream tool, matching its input_schema.",
    },
  },
  required: ["server_id", "tool_name"],
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false };

const SEARCH_TOOL = {
  name: "search",
  description:
    "Search everything the company knows: documents, wikis, tickets, chat messages, email and code. Returns the most relevant results.",
  annotations: READ_ONLY,
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "A short keyword query." },
    },
    required: ["query"],
  },
};

const READ_DOCUMENT_TOOL = {
  name: "read_document",
  description: "Read the full content of one or more documents by URL.",
  annotations: READ_ONLY,
  inputSchema: {
    type: "object",
    properties: {
      urls: { type: "array", items: { type: "string" } },
    },
    required: ["urls"],
  },
};

const TOOLS = {
  direct: [
    {
      name: "find_skills_and_tools",
      description: FIND_SKILLS_DESCRIPTION,
      annotations: READ_ONLY,
      inputSchema: QUERIES_SCHEMA,
    },
    {
      name: "read_skill_files",
      description: READ_SKILL_FILES_DESCRIPTION,
      annotations: READ_ONLY,
      inputSchema: {
        type: "object",
        properties: {
          skill_name: {
            type: "string",
            description:
              "The skill name from a previous find_skills_and_tools response.",
          },
          file_paths: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description:
              'Paths within the skill to read (e.g. "SKILL.md" for the playbook, "tools/<TOOL_NAME>.json" for tool schemas).',
          },
        },
        required: ["skill_name", "file_paths"],
      },
    },
    {
      name: "run_tool",
      description: RUN_TOOL_DESCRIPTION,
      inputSchema: RUN_TOOL_SCHEMA,
    },
    SEARCH_TOOL,
    READ_DOCUMENT_TOOL,
  ],
  "no-discovery": [SEARCH_TOOL, READ_DOCUMENT_TOOL],
  gateway: [
    {
      name: "find_skills_and_tools",
      description: "Discover Glean skills and the tools they use.",
      annotations: READ_ONLY,
      inputSchema: QUERIES_SCHEMA,
    },
    {
      name: "run_tool",
      description: RUN_TOOL_DESCRIPTION,
      inputSchema: RUN_TOOL_SCHEMA,
    },
    {
      name: "get_tool_approval",
      description: "Read the user's saved approval preference for a tool.",
      annotations: READ_ONLY,
      inputSchema: {
        type: "object",
        properties: {
          server_id: { type: "string" },
          tool_name: { type: "string" },
        },
        required: ["server_id", "tool_name"],
      },
    },
    SEARCH_TOOL,
    READ_DOCUMENT_TOOL,
  ],
  unrelated: [
    {
      name: "convert_units",
      description: "Convert a length between metres and feet.",
      annotations: READ_ONLY,
      inputSchema: {
        type: "object",
        properties: {
          value: { type: "number" },
          to: { type: "string", enum: ["metres", "feet"] },
        },
        required: ["value", "to"],
      },
    },
  ],
};

// What a client sees when it connects to the plugin's endpoint with no relay in
// between: the gateway list, plus the tool that saves Always Allow. The relay
// keeps that tool from the model; a direct client lists it.
TOOLS.proxy = [
  ...TOOLS.gateway.slice(0, 3),
  {
    name: "set_tool_approval",
    description:
      "Save the user's approval preference for a tool. ALWAYS_ALLOWED always allows the tool; UNSET clears any stored preference.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object",
      properties: {
        server_id: { type: "string" },
        tool_name: { type: "string" },
        value: { type: "string", enum: ["ALWAYS_ALLOWED", "UNSET"] },
      },
      required: ["server_id", "tool_name"],
    },
  },
  ...TOOLS.gateway.slice(3),
];

const text = (value) => ({ content: [{ type: "text", text: value }] });
const failure = (value) => ({ ...text(value), isError: true });

function words(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
}

function matchingSkills(queries) {
  const asked = new Set(queries.flatMap(words));
  return SKILLS.filter((skill) => skill.keywords.some((k) => asked.has(k)));
}

const escapeXml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function findSkills(shape, args) {
  const queries = Array.isArray(args.queries) ? args.queries : [];
  if (queries.length === 0) return failure("queries must list at least one entry.");
  const skills = matchingSkills(queries);
  if (shape === "gateway" || shape === "proxy") {
    return text(
      JSON.stringify({
        skills: Object.fromEntries(skills.map((s) => [s.name, s.files])),
      }),
    );
  }
  if (skills.length === 0) return text("<available_skills />");
  const entries = skills.map((skill) =>
    [
      `  <skill name="${escapeXml(skill.name)}" description="${escapeXml(skill.description)}">`,
      "    <files>",
      ...Object.keys(skill.files).map((p) => `      <file path="${p}" />`),
      "    </files>",
      "  </skill>",
    ].join("\n"),
  );
  return text(["<available_skills>", ...entries, "</available_skills>"].join("\n"));
}

function readSkillFiles(args) {
  const skill = SKILLS.find((s) => s.name === args.skill_name);
  if (!skill) return failure(`No skill named ${JSON.stringify(args.skill_name)}.`);
  const paths = Array.isArray(args.file_paths) ? args.file_paths : [];
  const missing = paths.filter((p) => !(p in skill.files));
  if (paths.length === 0 || missing.length > 0) {
    return failure(
      `No such file in ${skill.name}: ${missing.join(", ") || "(none given)"}. ` +
        `Files: ${Object.keys(skill.files).join(", ")}.`,
    );
  }
  const files = paths.map(
    (p) => `  <file path="${p}"><![CDATA[${skill.files[p]}]]></file>`,
  );
  return text(["<files>", ...files, "</files>"].join("\n"));
}

function runTool(args) {
  const tool = DOWNSTREAM_TOOLS.find(
    (t) => t.server_id === args.server_id && t.name === args.tool_name,
  );
  if (!tool) {
    return failure(
      `No tool ${JSON.stringify(args.tool_name)} on server ${JSON.stringify(args.server_id)}. ` +
        "Read the tool's definition from find_skills_and_tools for its server_id and name.",
    );
  }
  const given = args.arguments && typeof args.arguments === "object" ? args.arguments : {};
  const known = Object.keys(tool.inputSchema.properties);
  const unknown = Object.keys(given).filter((k) => !known.includes(k));
  const missing = tool.inputSchema.required.filter((k) => !(k in given));
  if (unknown.length > 0 || missing.length > 0) {
    return failure(
      `Invalid arguments for ${tool.name}.` +
        (unknown.length ? ` Unknown: ${unknown.join(", ")}.` : "") +
        (missing.length ? ` Missing: ${missing.join(", ")}.` : ""),
    );
  }
  if (tool.name === "run_jql") {
    const key = /[A-Z]+-\d+/.exec(String(given.jql_query))?.[0];
    const issues = key ? ISSUES.filter((issue) => issue.key === key) : ISSUES;
    return text(JSON.stringify({ totalCount: issues.length, issues }));
  }
  const events = EVENTS.filter(
    (event) =>
      event.start.startsWith(String(given.day)) &&
      event.attendees.includes(String(given.attendee_email).toLowerCase()),
  );
  return text(JSON.stringify({ events }));
}

function search(args) {
  const asked = new Set(words(args.query));
  const results = DOCUMENTS.filter((doc) => doc.keywords.some((k) => asked.has(k))).map(
    ({ url, title, app, text: snippet }) => ({ url, title, app, snippet }),
  );
  return text(JSON.stringify({ results }));
}

function readDocument(args) {
  const urls = Array.isArray(args.urls) ? args.urls : [];
  const documents = DOCUMENTS.filter((doc) => urls.includes(doc.url)).map(
    ({ url, title, text: content }) => ({ url, title, content }),
  );
  if (documents.length === 0) return failure("No document at those URLs.");
  return text(JSON.stringify({ documents }));
}

function callTool(shape, name, args) {
  if (!TOOLS[shape].some((tool) => tool.name === name)) {
    return failure(`Unknown tool: ${name}`);
  }
  switch (name) {
    case "find_skills_and_tools":
      return findSkills(shape, args);
    case "read_skill_files":
      return readSkillFiles(args);
    case "run_tool":
      return runTool(args);
    case "get_tool_approval":
      return text(JSON.stringify({ value: "ALWAYS_ALLOWED" }));
    case "set_tool_approval":
      return text(
        `Set approval preference for tool ${JSON.stringify(args.tool_name)} to ${args.value ?? "UNSET"}.`,
      );
    case "search":
      return search(args);
    case "read_document":
      return readDocument(args);
    case "convert_units":
      return text(
        String(args.to === "feet" ? args.value * 3.28084 : args.value / 3.28084),
      );
    default:
      return failure(`Unknown tool: ${name}`);
  }
}

/** Answer one JSON-RPC message. Returns undefined for a notification. */
export function handle(shape, message) {
  if (message.id === undefined || message.method === undefined) return undefined;
  const reply = (result) => ({ jsonrpc: "2.0", id: message.id, result });
  switch (message.method) {
    case "initialize":
      return reply({
        protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        // A neutral name: the model should not learn that this is a stub.
        serverInfo: { name: shape === "unrelated" ? "units" : "glean", version: "1.0.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS[shape] });
    case "tools/call":
      return reply(
        callTool(shape, message.params?.name, message.params?.arguments ?? {}),
      );
    default:
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Method not found: ${message.method}` },
      };
  }
}

/** Serve one shape over Streamable HTTP on a free loopback port. */
export function serveHttp(shape) {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let message;
      try {
        message = JSON.parse(body);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const response = handle(shape, message);
      if (response === undefined) {
        res.writeHead(202).end();
        return;
      }
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(response));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function serveStdio(shape) {
  const lines = readline.createInterface({ input: process.stdin });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const response = handle(shape, message);
    if (response !== undefined) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
  lines.on("close", () => process.exit(0));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const shape = process.argv[process.argv.indexOf("--shape") + 1];
  if (!SHAPES.includes(shape)) {
    console.error(`usage: glean-stub.mjs --shape <${SHAPES.join("|")}>`);
    process.exit(2);
  }
  serveStdio(shape);
}
