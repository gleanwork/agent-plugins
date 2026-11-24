// Synthetic data for the stub Glean server. Nothing here comes from a real
// deployment: the project, people, issues and events are made up.

export const JIRA_SERVER_ID = "stub-jira-7c1e";
export const CALENDAR_SERVER_ID = "stub-gcal-2f90";

const runJql = {
  server_id: JIRA_SERVER_ID,
  name: "run_jql",
  description:
    "Run a JQL (Jira Query Language) query and return the matching issues.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: {
    type: "object",
    properties: {
      jql_query: { type: "string", description: "The JQL query to run." },
      max_results: {
        type: "integer",
        description: "The most issues to return. Defaults to 20.",
      },
    },
    required: ["jql_query"],
  },
};

const listEvents = {
  server_id: CALENDAR_SERVER_ID,
  name: "list_events",
  description: "List a person's Google Calendar events on one day.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: {
    type: "object",
    properties: {
      attendee_email: {
        type: "string",
        description: "The email address of the person whose events to list.",
      },
      day: { type: "string", description: "The day, as YYYY-MM-DD." },
    },
    required: ["attendee_email", "day"],
  },
};

export const SKILLS = [
  {
    name: "jira-search",
    description:
      "Search Jira issues with JQL. Find issues by key, project, status, assignee or text, and read an issue's status and assignee.",
    keywords: ["jira", "issue", "ticket", "jql", "bug", "epic", "sprint"],
    files: {
      "SKILL.md": [
        "---",
        "name: jira-search",
        "description: Search Jira issues with JQL.",
        "---",
        "",
        "# Jira search",
        "",
        "Use the `run_jql` tool to find issues. Read `tools/run_jql.json` for its",
        "`server_id`, `name` and `inputSchema` before you call it.",
        "",
        "To read one issue, query by key, for example `key = DEMO-123`.",
        "",
      ].join("\n"),
      "tools/run_jql.json": JSON.stringify(runJql),
    },
  },
  {
    name: "calendar-lookup",
    description:
      "Look up Google Calendar events for a person on a given day: meetings, times and attendees.",
    keywords: ["calendar", "meeting", "event", "schedule", "gcal"],
    files: {
      "SKILL.md": [
        "---",
        "name: calendar-lookup",
        "description: Look up Google Calendar events.",
        "---",
        "",
        "# Calendar lookup",
        "",
        "Use the `list_events` tool. Read `tools/list_events.json` for its",
        "`server_id`, `name` and `inputSchema` before you call it.",
        "",
        "Priya Raman's address is priya.raman@example.com.",
        "",
      ].join("\n"),
      "tools/list_events.json": JSON.stringify(listEvents),
    },
  },
];

export const DOWNSTREAM_TOOLS = [runJql, listEvents];

export const ISSUES = [
  {
    key: "DEMO-4821",
    summary: "Rotate signing keys before the March audit",
    status: "In Review",
    assignee: "Priya Raman",
    updated: "2026-03-02",
  },
  {
    key: "DEMO-4790",
    summary: "Flaky export job on the billing worker",
    status: "Open",
    assignee: "Tomas Lindqvist",
    updated: "2026-02-27",
  },
];

export const EVENTS = [
  {
    title: "Vendor review with Northwind",
    start: "2026-03-14T14:30:00-07:00",
    end: "2026-03-14T15:15:00-07:00",
    attendees: ["priya.raman@example.com", "tomas.lindqvist@example.com"],
  },
];

// What company search has indexed. It holds the Jira issues (Glean indexes
// Jira), and a policy page. It holds no calendar events.
export const DOCUMENTS = [
  {
    url: "https://jira.example.com/browse/DEMO-4821",
    title: "DEMO-4821 Rotate signing keys before the March audit",
    app: "jira",
    text: "Status: In Review. Assignee: Priya Raman. Rotate the release signing keys before the March audit starts.",
    keywords: ["demo-4821", "signing", "keys", "rotate", "audit", "jira"],
  },
  {
    url: "https://jira.example.com/browse/DEMO-4790",
    title: "DEMO-4790 Flaky export job on the billing worker",
    app: "jira",
    text: "Status: Open. Assignee: Tomas Lindqvist. The nightly export job fails about one run in five.",
    keywords: ["demo-4790", "export", "billing", "worker", "flaky", "jira"],
  },
  {
    url: "https://wiki.example.com/security/key-rotation",
    title: "Signing key rotation policy",
    app: "confluence",
    text: "Release signing keys rotate every 75 days. The security team owns the rotation runbook.",
    keywords: ["signing", "key", "keys", "rotation", "rotate", "policy"],
  },
];
