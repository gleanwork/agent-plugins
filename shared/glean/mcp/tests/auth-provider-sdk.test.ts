import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  auth,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Keep the provider's real polling loop, but let Vitest control its sleeps.
vi.mock("node:timers/promises", () => ({
  setTimeout: (delay: number) =>
    new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay)),
}));

vi.mock("../src/auth-callback-server.js", () => ({
  getCallbackUrl: () => "http://127.0.0.1:29107/glean-cli-callback",
  setExpectedState: vi.fn(),
}));

import { GleanOAuthClientProvider } from "../src/auth-provider.js";
import { setExpectedState } from "../src/auth-callback-server.js";
import { loadCredentials, saveCredentials } from "../src/token-store.js";

const serverUrl = "https://mcp.example.test/mcp";
const issuer = "https://auth.example.test";
const resourceMetadataUrl = new URL(
  "https://mcp.example.test/.well-known/oauth-protected-resource/mcp",
);
const authMetadataUrl = `${issuer}/.well-known/oauth-authorization-server`;
const authorizationEndpoint = `${issuer}/authorize`;
const tokenEndpoint = `${issuer}/token`;
const registrationEndpoint = `${issuer}/register`;
const callbackUrl = "http://127.0.0.1:29107/glean-cli-callback";

// Stamp both clients and tokens up front. SDK v2 otherwise writes an issuer
// migration before refreshing, which can overwrite the sibling's disk state.
const originalClient: StoredOAuthClientInformation = {
  client_id: "client-0",
  issuer,
};
const originalTokens: StoredOAuthTokens = {
  access_token: "T0",
  refresh_token: "R0",
  token_type: "Bearer",
  issuer,
};
const siblingTokens: StoredOAuthTokens = {
  access_token: "T1",
  refresh_token: "R1",
  token_type: "Bearer",
  issuer,
};
const refreshedTokenResponse = {
  access_token: "T2",
  refresh_token: "R2",
  token_type: "Bearer",
};
const refreshedTokens: StoredOAuthTokens = { ...refreshedTokenResponse, issuer };
const registeredClientResponse = {
  client_id: "client-1",
  redirect_uris: [callbackUrl],
  token_endpoint_auth_method: "none",
};
const registeredClient = { ...registeredClientResponse, issuer };

const discoveryRequests = [
  `GET ${resourceMetadataUrl.href}`,
  `GET ${authMetadataUrl}`,
];

type RefreshError = "invalid_grant" | "invalid_client" | "unauthorized_client";

// Only HTTP is faked. Real SDK discovery, response parsing, error dispatch,
// registration, PKCE, and auth retries run against the real provider/store.
function makeOAuthServer(error: RefreshError) {
  const requests: string[] = [];
  const refreshRequests: Record<string, string>[] = [];
  const registrations: unknown[] = [];
  const credentialsAtRegistration: ReturnType<typeof loadCredentials>[] = [];
  const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const request = `${init?.method ?? "GET"} ${String(url)}`;
    requests.push(request);
    switch (request) {
      case `GET ${resourceMetadataUrl.href}`:
        return Response.json({
          resource: serverUrl,
          authorization_servers: [issuer],
          scopes_supported: ["mcp"],
        });
      case `GET ${authMetadataUrl}`:
        return Response.json({
          issuer,
          authorization_endpoint: authorizationEndpoint,
          token_endpoint: tokenEndpoint,
          registration_endpoint: registrationEndpoint,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          token_endpoint_auth_methods_supported: ["none"],
          code_challenge_methods_supported: ["S256"],
        });
      case `POST ${tokenEndpoint}`: {
        const params = new URLSearchParams(String(init?.body));
        refreshRequests.push(Object.fromEntries(params));
        if (params.get("refresh_token") === "R0") {
          return Response.json(
            { error, error_description: "Synthetic refresh rejection" },
            { status: error === "invalid_client" ? 401 : 400 },
          );
        }
        if (params.get("refresh_token") === "R1") {
          return Response.json(refreshedTokenResponse);
        }
        throw new Error("Unexpected refresh token in test HTTP request");
      }
      case `POST ${registrationEndpoint}`:
        registrations.push(JSON.parse(String(init?.body)));
        credentialsAtRegistration.push(loadCredentials());
        return Response.json(registeredClientResponse, { status: 201 });
      default:
        throw new Error(`Unexpected test HTTP request: ${request}`);
    }
  });
  return {
    fetchFn,
    requests,
    refreshRequests,
    registrations,
    credentialsAtRegistration,
  };
}

function refreshRequest(refreshToken: string) {
  return {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: originalClient.client_id,
    resource: serverUrl,
  };
}

function observeProvider(provider: GleanOAuthClientProvider) {
  provider.onTokensChanged = vi.fn();
  return {
    invalidate: vi.spyOn(provider, "invalidateCredentials"),
    wait: vi.spyOn(provider, "waitForSiblingRefresh"),
    saveClient: vi.spyOn(provider, "saveClientInformation"),
    saveTokens: vi.spyOn(provider, "saveTokens"),
    redirect: vi.spyOn(provider, "redirectToAuthorization"),
  };
}

function expectAuthorizationRedirect(
  provider: GleanOAuthClientProvider,
  clientId: string,
) {
  expect(provider.authorizationUrl).toBeDefined();
  const url = new URL(provider.authorizationUrl!);
  expect(`${url.origin}${url.pathname}`).toBe(authorizationEndpoint);
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    resource: serverUrl,
    scope: "mcp",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256")
      .update(provider.codeVerifier())
      .digest("base64url"),
  });
  expect(provider.codeVerifier()).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(setExpectedState).toHaveBeenCalledExactlyOnceWith(
    url.searchParams.get("state"),
  );
}

describe("GleanOAuthClientProvider with real SDK auth()", () => {
  let dataDir: string;
  let provider: GleanOAuthClientProvider;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-provider-sdk-test-"));
    vi.stubEnv("PLUGIN_DATA_DIR", dataDir);
    // Fail closed if any SDK path forgets the explicit fake HTTP boundary.
    vi.stubGlobal("fetch", vi.fn(() => {
      throw new Error("Network access is forbidden in OAuth SDK tests");
    }));
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    saveCredentials(originalTokens, originalClient);
    provider = new GleanOAuthClientProvider();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("retries invalid_grant with a sibling's R1 and persists T2/R2 without resetting the client", async () => {
    const sibling = new GleanOAuthClientProvider();
    const observed = observeProvider(provider);
    const server = makeOAuthServer("invalid_grant");
    const result = auth(provider, { serverUrl, resourceMetadataUrl, fetchFn: server.fetchFn });

    await vi.advanceTimersByTimeAsync(0);
    expect(server.refreshRequests).toEqual([refreshRequest("R0")]);
    expect(observed.invalidate.mock.calls).toEqual([["tokens"]]);
    expect(observed.wait).toHaveBeenCalledExactlyOnceWith("T0");

    // The other process finishes after invalid_grant, while our real provider
    // is asleep. It must adopt the atomic disk write at the next 500 ms poll.
    await vi.advanceTimersByTimeAsync(250);
    sibling.saveTokens(siblingTokens);
    expect(loadCredentials()).toEqual({ tokens: siblingTokens, clientInfo: originalClient });
    await vi.advanceTimersByTimeAsync(249);
    expect(server.refreshRequests).toHaveLength(1);
    expect(observed.saveTokens).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe("AUTHORIZED");
    expect(server.refreshRequests).toEqual([refreshRequest("R0"), refreshRequest("R1")]);
    expect(server.requests).toEqual([
      ...discoveryRequests, `POST ${tokenEndpoint}`,
      ...discoveryRequests, `POST ${tokenEndpoint}`,
    ]);
    expect(observed.invalidate.mock.calls).toEqual([["tokens"]]);
    expect(observed.saveTokens).toHaveBeenCalledExactlyOnceWith(refreshedTokens, { issuer });
    expect(provider.onTokensChanged).toHaveBeenCalledExactlyOnceWith(refreshedTokens);
    expect(provider.tokens()).toEqual(refreshedTokens);
    expect(provider.clientInformation()).toEqual(originalClient);
    expect(loadCredentials()).toEqual({ tokens: refreshedTokens, clientInfo: originalClient });
    expect(observed.saveClient).not.toHaveBeenCalled();
    expect(server.registrations).toEqual([]);
    expect(observed.redirect).not.toHaveBeenCalled();
    expect(provider.authorizationUrl).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits the full 2 seconds on genuine invalid_grant, then clears tokens and redirects with the same client", async () => {
    const observed = observeProvider(provider);
    const server = makeOAuthServer("invalid_grant");
    const startedAt = Date.now();
    const result = auth(provider, { serverUrl, resourceMetadataUrl, fetchFn: server.fetchFn });

    await vi.advanceTimersByTimeAsync(0);
    expect(observed.invalidate.mock.calls).toEqual([["tokens"]]);
    expect(observed.wait).toHaveBeenCalledExactlyOnceWith("T0");
    for (const elapsed of [500, 500, 500, 499]) {
      await vi.advanceTimersByTimeAsync(elapsed);
      expect(loadCredentials()).toEqual({ tokens: originalTokens, clientInfo: originalClient });
      expect(server.refreshRequests).toEqual([refreshRequest("R0")]);
      expect(observed.redirect).not.toHaveBeenCalled();
      expect(provider.onTokensChanged).not.toHaveBeenCalled();
    }
    expect(Date.now() - startedAt).toBe(1999);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toBe("REDIRECT");
    expect(Date.now() - startedAt).toBe(2000);
    expect(server.requests).toEqual([
      ...discoveryRequests, `POST ${tokenEndpoint}`, ...discoveryRequests,
    ]);
    expect(observed.invalidate.mock.calls).toEqual([["tokens"]]);
    expect(provider.tokens()).toBeUndefined();
    expect(provider.clientInformation()).toEqual(originalClient);
    expect(loadCredentials()).toEqual({ clientInfo: originalClient });
    expect(provider.onTokensChanged).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(observed.saveClient).not.toHaveBeenCalled();
    expect(observed.saveTokens).not.toHaveBeenCalled();
    expect(server.registrations).toEqual([]);
    expect(observed.redirect).toHaveBeenCalledTimes(1);
    expectAuthorizationRedirect(provider, originalClient.client_id);
    expect(vi.getTimerCount()).toBe(0);
  });

  describe.each(["invalid_client", "unauthorized_client"] as const)("%s", (error) => {
    it.each([false, true])(
      "resets client then tokens without grace and re-registers (sibling write after client reset: %s)",
      async (writeSibling) => {
        const sibling = new GleanOAuthClientProvider();
        const observed = observeProvider(provider);
        const server = makeOAuthServer(error);
        const startedAt = Date.now();
        const result = auth(provider, { serverUrl, resourceMetadataUrl, fetchFn: server.fetchFn });

        if (writeSibling) {
          // Observe the SDK's await between its two real invalidations. A
          // bounded microtask loop permits the sibling write at that boundary
          // without replacing authInternal() or invalidateCredentials().
          for (let hop = 0; hop < 100 && provider.clientInformation(); hop++) {
            await Promise.resolve();
          }
          expect(observed.invalidate.mock.calls).toEqual([["client"]]);
          expect(provider.clientInformation()).toBeUndefined();
          expect(loadCredentials()).toEqual({ tokens: originalTokens });
          sibling.saveTokens(siblingTokens);
          expect(loadCredentials()).toEqual({ tokens: siblingTokens, clientInfo: originalClient });
        }

        await vi.advanceTimersByTimeAsync(0);
        expect(observed.invalidate.mock.calls).toEqual([["client"], ["tokens"]]);
        expect(observed.wait).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
        await expect(result).resolves.toBe("REDIRECT");

        expect(Date.now() - startedAt).toBe(0);
        expect(server.refreshRequests).toEqual([refreshRequest("R0")]);
        expect(server.requests).toEqual([
          ...discoveryRequests, `POST ${tokenEndpoint}`,
          ...discoveryRequests, `POST ${registrationEndpoint}`,
        ]);
        expect(server.credentialsAtRegistration).toEqual([{}]);
        expect(server.registrations).toEqual([{
          redirect_uris: [callbackUrl],
          client_name: "Glean Claude Code Plugin",
          application_type: "native",
          grant_types: ["authorization_code", "refresh_token"],
          scope: "mcp",
        }]);
        expect(observed.saveClient).toHaveBeenCalledExactlyOnceWith(registeredClient, { issuer });
        expect(observed.invalidate.mock.invocationCallOrder[1]).toBeLessThan(
          observed.saveClient.mock.invocationCallOrder[0],
        );
        expect(observed.saveTokens).not.toHaveBeenCalled();
        expect(provider.tokens()).toBeUndefined();
        expect(provider.clientInformation()).toEqual(registeredClient);
        expect(loadCredentials()).toEqual({ clientInfo: registeredClient });
        expect(provider.onTokensChanged).toHaveBeenCalledExactlyOnceWith(undefined);
        expect(observed.redirect).toHaveBeenCalledTimes(1);
        expectAuthorizationRedirect(provider, registeredClient.client_id);
      },
    );
  });
});
