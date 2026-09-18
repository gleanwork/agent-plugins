import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UnauthorizedError,
  OAuthError,
  OAuthErrorCode,
} from "@modelcontextprotocol/client";

// Control client.connect() across (re)tries while preserving the real SDK errors.
const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock("@modelcontextprotocol/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@modelcontextprotocol/client")>()),
  Client: class {
    async connect(...args: unknown[]) {
      return connectMock(...args);
    }
  },
  StreamableHTTPClientTransport: class {
    constructor() {}
    async close() {}
  },
}));

const { createRemoteClient, AuthRequiredError } = await import(
  "../src/remote-client.js"
);

const serverUrl = "https://acme-be.glean.com/mcp/gateway/proxy";

/**
 * Minimal OAuthClientProvider stand-in. tokens() returns the next value in
 * `seq` on each call, mirroring how the real provider re-reads disk: the
 * pre-connect snapshot, then the value after a sibling may have rewritten it.
 */
function makeProvider(seq: Array<{ access_token?: string } | undefined>) {
  let i = 0;
  return {
    tokens() {
      const t = seq[Math.min(i, seq.length - 1)];
      i += 1;
      return t;
    },
    authorizationUrl: "https://example.com/oauth/authorize?state=s1",
    pendingAuthCode: undefined,
    needsFreshClient: () => false,
  } as any;
}

beforeEach(() => {
  connectMock.mockReset();
});

describe("createRemoteClient sibling-refresh retry", () => {
  it("retries once and succeeds when a newer token appears on disk", async () => {
    connectMock
      .mockRejectedValueOnce(new UnauthorizedError("401"))
      .mockResolvedValueOnce(undefined);

    // Pre-connect T0, post-failure T1, retry snapshot T1.
    const provider = makeProvider([
      { access_token: "T0" },
      { access_token: "T1" },
      { access_token: "T1" },
    ]);

    const client = await createRemoteClient(
      serverUrl,
      { authProvider: provider },
      "sess-1",
    );

    expect(client).toBeTruthy();
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("retries when a sibling supplies the first available token", async () => {
    connectMock
      .mockRejectedValueOnce(new UnauthorizedError("401"))
      .mockResolvedValueOnce(undefined);
    const provider = makeProvider([undefined, { access_token: "T1" }]);

    const client = await createRemoteClient(serverUrl, { authProvider: provider });

    expect(client).toBeTruthy();
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the on-disk token is unchanged", async () => {
    connectMock.mockRejectedValue(new UnauthorizedError("401"));
    const provider = makeProvider([{ access_token: "T0" }]);

    await expect(
      createRemoteClient(serverUrl, { authProvider: provider }),
    ).rejects.toBeInstanceOf(AuthRequiredError);

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry twice even if another token appears after the retry fails", async () => {
    connectMock.mockRejectedValue(new UnauthorizedError("401"));
    const provider = makeProvider([
      { access_token: "T0" },
      { access_token: "T1" },
      { access_token: "T1" },
      { access_token: "T2" },
    ]);

    await expect(
      createRemoteClient(serverUrl, { authProvider: provider }),
    ).rejects.toBeInstanceOf(AuthRequiredError);

    expect(connectMock).toHaveBeenCalledTimes(2);
  });
});

function makeCollisionProvider(siblingRefreshed: boolean) {
  let accessToken = "T0";
  return {
    tokens: () => ({ access_token: accessToken, refresh_token: "R0" }),
    authorizationUrl: undefined,
    pendingAuthCode: undefined,
    needsFreshClient: () => false,
    waitForSiblingRefresh: vi.fn(async () => {
      if (siblingRefreshed) accessToken = "T1";
      return siblingRefreshed;
    }),
    invalidateCredentials: vi.fn(),
  } as any;
}

describe.each([
  OAuthErrorCode.InvalidRequest,
  OAuthErrorCode.InvalidGrant,
])("createRemoteClient %s refresh-collision retry", (code) => {
  const collisionError = new OAuthError(code, "Refresh request rejected");

  it("retries once when a sibling's refresh lands during the grace wait", async () => {
    connectMock
      .mockRejectedValueOnce(collisionError)
      .mockResolvedValueOnce(undefined);
    const provider = makeCollisionProvider(true);

    const client = await createRemoteClient(serverUrl, { authProvider: provider });

    expect(client).toBeTruthy();
    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(provider.waitForSiblingRefresh).toHaveBeenCalledExactlyOnceWith("T0");
  });

  it("rethrows when no sibling token appears within the grace window", async () => {
    connectMock.mockRejectedValue(collisionError);
    const provider = makeCollisionProvider(false);

    await expect(
      createRemoteClient(serverUrl, { authProvider: provider }),
    ).rejects.toBe(collisionError);

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("rethrows a failed retry without waiting or connecting again", async () => {
    connectMock.mockRejectedValue(collisionError);
    const provider = makeCollisionProvider(true);

    await expect(
      createRemoteClient(serverUrl, { authProvider: provider }),
    ).rejects.toBe(collisionError);

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(provider.waitForSiblingRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("createRemoteClient non-recoverable errors", () => {
  it("rethrows unauthorized errors without a newer token or a sign-in URL", async () => {
    const error = new UnauthorizedError("401");
    connectMock.mockRejectedValue(error);
    const provider = makeCollisionProvider(false);

    await expect(
      createRemoteClient(serverUrl, { authProvider: provider }),
    ).rejects.toBe(error);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(provider.waitForSiblingRefresh).not.toHaveBeenCalled();
  });

  it.each([
    new Error("Failed to refresh token"),
    new OAuthError(OAuthErrorCode.InvalidClient, "Invalid client"),
    new OAuthError(OAuthErrorCode.InvalidScope, "Invalid scope"),
    { code: OAuthErrorCode.InvalidGrant },
  ])("does not retry an unrelated or untyped error: %s", async (error) => {
    connectMock.mockRejectedValue(error);
    const provider = makeCollisionProvider(true);

    await expect(
      createRemoteClient(serverUrl, { authProvider: provider }),
    ).rejects.toBe(error);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(provider.waitForSiblingRefresh).not.toHaveBeenCalled();
  });

  it.each([
    new UnauthorizedError("401"),
    new OAuthError(OAuthErrorCode.InvalidRequest, "Invalid request"),
    new OAuthError(OAuthErrorCode.InvalidGrant, "Invalid grant"),
  ])("rethrows without an auth provider and does not retry: %s", async (error) => {
    connectMock.mockRejectedValue(error);

    await expect(createRemoteClient(serverUrl, {})).rejects.toBe(error);

    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});
