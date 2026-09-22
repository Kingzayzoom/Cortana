import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
const googleAuth = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      jar.store.has(name) ? { value: jar.store.get(name) } : undefined,
    set: (name: string, value: string) => jar.store.set(name, value),
    delete: ({ name }: { name: string }) => jar.store.delete(name),
  })),
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = googleAuth.verifyIdToken;
  },
}));

import {
  accountId,
  beginGoogleAuth,
  completeGoogleAuth,
  consumeOAuthCookie,
  googleConfigured,
  redirectUri,
} from "../src/lib/server/auth";
import { profileSession, setProfileSession } from "../src/lib/server/session";
import {
  emptyProgress,
  linkAccount,
  withProgress,
} from "../src/lib/server/store";

const CLIENT_ID = "123.apps.googleusercontent.com";
const request = () =>
  new Request("http://localhost:3100/api/auth/google", {
    headers: { host: "localhost:3100" },
  });

const idToken = (claims: Record<string, unknown>) =>
  [
    Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");

const validClaims = (overrides: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: "1098765432100",
  email: "clinician@example.com",
  email_verified: true,
  name: "Dr. Maya Patel",
  picture: "https://lh3.googleusercontent.com/a/photo",
  ...overrides,
});

const tokenResponds = (body: unknown, ok = true) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), { status: ok ? 200 : 400 }),
    ),
  );

beforeEach(async () => {
  jar.store.clear();
  vi.stubEnv("CORTANA_SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret-never-returned");
  vi.stubEnv(
    "CORTANA_DATA_DIR",
    await mkdtemp(path.join(tmpdir(), "cortana-auth-")),
  );
  googleAuth.verifyIdToken.mockReset();
  googleAuth.verifyIdToken.mockImplementation(
    async ({ idToken: token }: { idToken: string; audience: string }) => {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      );
      return { getPayload: () => payload };
    },
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("authorization request", () => {
  it("sends PKCE and a state that the callback can verify", async () => {
    const url = new URL(await beginGoogleAuth(request()));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri(request()));
    expect(await consumeOAuthCookie(url.searchParams.get("state")!)).toMatch(
      /^[\w-]+$/,
    );
  });

  it("never puts the verifier in the authorization URL", async () => {
    const url = new URL(await beginGoogleAuth(request()));
    const verifier = await consumeOAuthCookie(url.searchParams.get("state")!);
    expect(url.toString()).not.toContain(verifier!);
  });

  it("rejects a forged or replayed state", async () => {
    const url = new URL(await beginGoogleAuth(request()));
    const state = url.searchParams.get("state")!;
    expect(await consumeOAuthCookie("not-the-state")).toBeNull();
    // The cookie is single-use, so the genuine state no longer works either.
    expect(await consumeOAuthCookie(state)).toBeNull();
  });

  it("reports missing configuration instead of redirecting", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(googleConfigured()).toBe(false);
    await expect(beginGoogleAuth(request())).rejects.toThrow(/not configured/i);
  });
});

describe("id token claims", () => {
  const exchange = () => completeGoogleAuth(request(), "auth-code", "verifier");

  it("accepts a well-formed token and returns only safe fields", async () => {
    tokenResponds({
      id_token: idToken(validClaims()),
      access_token: "secret-access-token",
    });
    const account = await exchange();
    expect(account).toEqual({
      provider: "google",
      subject: "1098765432100",
      email: "clinician@example.com",
      name: "Dr. Maya Patel",
      picture: "https://lh3.googleusercontent.com/a/photo",
    });
    expect(JSON.stringify(account)).not.toContain("secret-access-token");
    expect(googleAuth.verifyIdToken).toHaveBeenCalledWith({
      idToken: expect.any(String),
      audience: CLIENT_ID,
    });
  });

  it("rejects a token when Google's signature verification fails", async () => {
    tokenResponds({ id_token: idToken(validClaims()) });
    googleAuth.verifyIdToken.mockRejectedValueOnce(
      new Error("invalid signature"),
    );
    await expect(exchange()).rejects.toThrow(/could not verify/i);
  });

  it("rejects another application's audience", async () => {
    tokenResponds({
      id_token: idToken(validClaims({ aud: "999.apps.googleusercontent.com" })),
    });
    await expect(exchange()).rejects.toThrow(/issued for another application/i);
  });

  it("rejects an unexpected issuer", async () => {
    tokenResponds({
      id_token: idToken(validClaims({ iss: "https://evil.example" })),
    });
    await expect(exchange()).rejects.toThrow(/unexpected issuer/i);
  });

  it("rejects an expired token", async () => {
    tokenResponds({
      id_token: idToken(
        validClaims({ exp: Math.floor(Date.now() / 1000) - 5 }),
      ),
    });
    await expect(exchange()).rejects.toThrow(/expired/i);
  });

  it("rejects an unverified email", async () => {
    tokenResponds({
      id_token: idToken(validClaims({ email_verified: false })),
    });
    await expect(exchange()).rejects.toThrow(/verify your google email/i);
  });

  it("rejects a subject that could escape the data directory", async () => {
    tokenResponds({
      id_token: idToken(validClaims({ sub: "../../etc/passwd" })),
    });
    await expect(exchange()).rejects.toThrow(/incomplete sign-in token/i);
  });

  it("does not leak the provider error body", async () => {
    tokenResponds(
      { error: "invalid_grant", client_secret: "leaked-secret" },
      false,
    );
    // Assert on the caught error directly: `.rejects.not` would also pass if
    // the call unexpectedly resolved.
    const error = await exchange().then(
      () => {
        throw new Error("exchange should have rejected");
      },
      (caught: Error) => caught,
    );
    expect(error.message).toMatch(/already used or expired/i);
    expect(error.message).not.toContain("leaked-secret");
  });
});

describe("profile linking", () => {
  const account = {
    provider: "google" as const,
    subject: "1098765432100",
    email: "clinician@example.com",
    name: "Dr. Maya Patel",
    picture: null,
  };
  const file = (id: string) =>
    path.join(process.env.CORTANA_DATA_DIR!, `${id}.json`);

  it("carries anonymous progress into the account on first sign-in", async () => {
    const anonymous = "11111111-1111-4111-8111-111111111111";
    await withProgress(anonymous, (data) => {
      data.practiceDays.push("2026-09-18");
      data.completions.push({
        roundId: "dapa-hf-01",
        at: "2026-09-18T10:00:00.000Z",
        date: "2026-09-18",
        xp: 120,
        version: "2026-09-19.1",
      });
    });
    const result = await linkAccount(
      anonymous,
      accountId(account.subject),
      account,
    );
    expect(result.xp).toBe(120);
    expect(result.account?.email).toBe("clinician@example.com");
    expect(result.signedIn).toBe(true);
    // The anonymous profile is emptied, not copied: whichever storage adapter
    // is in use, its history cannot be resumed once an account has claimed it.
    const left = JSON.parse(await readFile(file(anonymous), "utf8"));
    expect(left.completions).toEqual([]);
    expect(left.practiceDays).toEqual([]);
    expect(left.attempts).toEqual([]);
    expect(left.run).toBeNull();
  });

  it("keeps the account's own history when it already has a profile", async () => {
    const existing = { ...emptyProgress(), practiceDays: ["2026-09-01"] };
    await writeFile(file(accountId(account.subject)), JSON.stringify(existing));
    const anonymous = "22222222-2222-4222-8222-222222222222";
    await withProgress(anonymous, (data) =>
      data.practiceDays.push("2026-09-19"),
    );

    const result = await linkAccount(
      anonymous,
      accountId(account.subject),
      account,
    );
    expect(result.practiceDays).toEqual(["2026-09-01"]);
    // The anonymous profile is left untouched rather than silently destroyed.
    expect(
      JSON.parse(await readFile(file(anonymous), "utf8")).practiceDays,
    ).toEqual(["2026-09-19"]);
  });

  it("signs the account cookie so a profile id cannot be forged", async () => {
    await setProfileSession(accountId(account.subject));
    expect(await profileSession()).toBe("g-1098765432100");
    jar.store.set("cortana_session", "g-999999.deadbeef");
    expect(await profileSession()).toBeNull();
  });
});
