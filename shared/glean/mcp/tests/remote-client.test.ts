import { describe, it, expect, afterEach, vi } from "vitest";
import type { Client } from "@modelcontextprotocol/client";
import {
  acceptedContent,
  createMcpHandler,
  inputRequired,
  McpServer,
  type CallToolResult as ModernCallToolResult,
  type InputRequiredResult,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  callRemoteTool,
  createRemoteClient,
  remoteToolTimeoutMs,
} from "../src/remote-client.js";

describe("remoteToolTimeoutMs", () => {
  const KEY = "GLEAN_REMOTE_TOOL_TIMEOUT_MS";
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it("defaults to 300000ms when unset", () => {
    delete process.env[KEY];
    expect(remoteToolTimeoutMs()).toBe(300_000);
  });

  it("honors a valid positive override", () => {
    process.env[KEY] = "120000";
    expect(remoteToolTimeoutMs()).toBe(120_000);
  });

  it("falls back to default on a non-numeric value", () => {
    process.env[KEY] = "not-a-number";
    expect(remoteToolTimeoutMs()).toBe(300_000);
  });

  it("falls back to default on zero or negative values", () => {
    process.env[KEY] = "0";
    expect(remoteToolTimeoutMs()).toBe(300_000);
    process.env[KEY] = "-5";
    expect(remoteToolTimeoutMs()).toBe(300_000);
  });
});

describe("callRemoteTool", () => {
  const KEY = "GLEAN_REMOTE_TOOL_TIMEOUT_MS";
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it("passes the configured timeout to client.callTool", async () => {
    const calls: Array<{ params: unknown; options: unknown }> = [];
    const fakeClient = {
      callTool: async (params: unknown, options: unknown) => {
        calls.push({ params, options });
        return { content: [{ type: "text", text: "ok" }] };
      },
    } as unknown as Client;

    process.env[KEY] = "12345";
    const result = await callRemoteTool(fakeClient, "some_tool", { a: 1 });

    expect(calls).toHaveLength(1);
    expect(calls[0].params).toMatchObject({
      name: "some_tool",
      arguments: { a: 1 },
    });
    expect(
      (calls[0].params as { _meta?: Record<string, unknown> })._meta,
    ).toHaveProperty("com.glean.mcp/capabilityPolicy");
    expect(calls[0].options).toEqual({ timeout: 12345 });
    expect(result.content).toEqual([{ type: "text", text: "ok" }]);
  });

  it("normalizes a result with no content field", async () => {
    const fakeClient = {
      callTool: async () => ({}),
    } as unknown as Client;

    const result = await callRemoteTool(fakeClient, "some_tool", {});
    expect(result).toEqual({ content: [] });
  });
});

describe("remote elicitation bridge", () => {
  it("forwards input_required to the local host and resumes with requestState", async () => {
    let invocations = 0;
    const requestStates: Array<string | undefined> = [];
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "test", version: "1.0.0" });
      server.registerTool(
        "approve",
        { inputSchema: z.object({}) },
        async (_args, ctx): Promise<ModernCallToolResult | InputRequiredResult> => {
          invocations += 1;
          requestStates.push(ctx.mcpReq.requestState<string>());
          const answer = acceptedContent<{ approved: boolean }>(
            ctx.mcpReq.inputResponses,
            "approval",
          );
          if (!answer?.approved) {
            return inputRequired({
              inputRequests: {
                approval: inputRequired.elicit({
                  message: "Approve this action?",
                  requestedSchema: {
                    type: "object",
                    properties: { approved: { type: "boolean" } },
                    required: ["approved"],
                  },
                }),
              },
              requestState: "opaque-state",
            });
          }
          return { content: [{ type: "text", text: "executed" }] };
        },
      );
      return server;
    });
    const elicitInput = vi.fn().mockResolvedValue({
      action: "accept",
      content: { approved: true },
    });
    const client = await createRemoteClient("http://test.local/mcp", {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
      elicitInput,
    });

    try {
      expect(client.getProtocolEra()).toBe("modern");
      const result = await callRemoteTool(client, "approve", {});

      expect(result.content).toEqual([{ type: "text", text: "executed" }]);
      expect(elicitInput).toHaveBeenCalledTimes(1);
      expect(elicitInput.mock.calls[0][0]).toMatchObject({
        message: "Approve this action?",
        requestedSchema: {
          type: "object",
          properties: { approved: { type: "boolean" } },
        },
      });
      expect(invocations).toBe(2);
      expect(requestStates).toEqual([undefined, "opaque-state"]);
    } finally {
      await client.close();
      await handler.close();
    }
  });
});

describe("remote transport headers", () => {
  it("sends no X-Glean-* header and keeps the sc query parameter", async () => {
    const handler = createMcpHandler(
      () => new McpServer({ name: "test", version: "1.0.0" }),
    );
    const requests: Request[] = [];
    const client = await createRemoteClient(
      "http://test.local/mcp?sc=request-scope",
      {
        fetch: (url, init) => {
          const request = new Request(url, init);
          requests.push(request);
          return handler.fetch(request);
        },
      },
    );

    try {
      expect(requests.length).toBeGreaterThan(0);
      for (const request of requests) {
        expect(new URL(request.url).searchParams.get("sc")).toBe("request-scope");
        // Glean's edge can reject a request from outside that carries one of
        // its internal headers, so the client sends none.
        const gleanHeaders = [...request.headers.keys()].filter((name) =>
          name.toLowerCase().startsWith("x-glean-"),
        );
        expect(gleanHeaders).toEqual([]);
      }
    } finally {
      await client.close();
      await handler.close();
    }
  });
});
