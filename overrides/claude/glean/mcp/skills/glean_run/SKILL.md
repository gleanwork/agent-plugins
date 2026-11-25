---
name: glean_run
description: Discover and run Glean skills for enterprise app tasks
argument-hint: <task description>
---

# Glean Run

Use Glean's skills and connected tools for a task in an enterprise app (Jira,
Slack, Google Workspace, Salesforce and others), or for an action that no other
tool covers. Complete the request end to end where you can. Do not stop at a
list of skills.

## Check what you have

The Glean server decides which tools you get, and the list differs between
deployments. Your tool list is the source of truth. This skill names tools as
examples. Never call a tool that is not in your list.

Look in your tool list for the Glean tools `find_skills_and_tools` and
`run_tool`. The host may put a prefix before each name.

- **Both are there.** Go to Step 1.
- **There are no Glean tools at all.** The Glean server is not connected. Tell
  the user that the Glean plugin needs its server URL and a sign-in. In Claude
  Code, the URL is in the Glean plugin's options under `/plugin`, and sign-in is
  under `/mcp`. Then stop.
- **There are Glean tools, but not these two.** This server does not offer
  skill discovery. Do the task with the Glean tools you do have, such as
  `search` if it is in your list. Tell the user which part you could not do,
  and that a Glean admin decides whether the server offers skill discovery.

## Step 1: Discover

If the user gave no task and you cannot infer one from the conversation, ask
what they want to do.

Break the request into small queries with one action each. Keep the action and
drop the context around it, such as recipients, timing and reasons. Pass each
query as its own entry in `queries`.

```
find_skills_and_tools({
  queries: [
    "<one action>",
    "<another action>"
  ]
})
```

You can call `find_skills_and_tools` again as you work, for example once for
each part of a broad request.

## Step 2: Read the skill and its tools

The description of `find_skills_and_tools` in your tool list says how to read
its result. Follow that description, because the format differs between
servers. Some servers return every file in the result. Others return file names
that you fetch with a second tool, such as `read_skill_files`, if it is in your
list.

Pick the skill that fits the request best. Read its `SKILL.md` when the result
lists one. Then read the definition of each tool you plan to call, to get its
exact `server_id`, `name` and `inputSchema`.

## Step 3: Run the tool

Call `run_tool` with the `server_id`, the `tool_name` from the `name` field,
and `arguments` that match the `inputSchema` exactly.

```
run_tool({
  server_id: "<server_id from the tool definition>",
  tool_name: "<name from the tool definition>",
  arguments: { ... }
})
```

Pass only the parameters that the `run_tool` schema in your tool list defines.

## Rules

- Never guess parameter names. Read the tool definition before you call
  `run_tool`.
- If the server refuses a call or asks the user to approve it, report that. Do
  not work around it.
- If discovery returns nothing that fits, tell the user what you searched for.
