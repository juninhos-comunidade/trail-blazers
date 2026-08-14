import { describe, expect, it } from "vitest";

import { decodeJwt, getExpiresAt, isExpired } from "./jwt";
import { signTestToken } from "../test/jwt-helpers";

describe("decodeJwt", () => {
  it("decodes a valid token", () => {
    const token = signTestToken({ sub: "u1", username: "octocat", exp: 1000 });
    expect(decodeJwt(token)).toEqual({
      sub: "u1",
      username: "octocat",
      exp: 1000,
    });
  });

  it("returns null when the token doesn't have 3 segments", () => {
    expect(decodeJwt("a.b")).toBeNull();
    expect(decodeJwt("a.b.c.d")).toBeNull();
  });

  it("decodes base64url segments using - and _", () => {
    const token = signTestToken({ username: "a>>b??c" });
    const payload = decodeJwt(token);
    expect(payload?.username).toBe("a>>b??c");
  });

  it("returns null for malformed JSON in the payload", () => {
    const header = btoa(JSON.stringify({ alg: "none" }));
    const badPayload = btoa("not json");
    expect(decodeJwt(`${header}.${badPayload}.sig`)).toBeNull();
  });

  it("returns null when payload is missing sub or username", () => {
    const header = btoa(JSON.stringify({ alg: "none" }));
    const payload = btoa(JSON.stringify({ sub: "u1" }));
    expect(decodeJwt(`${header}.${payload}.sig`)).toBeNull();
  });

  it("returns null when payload is not an object", () => {
    const header = btoa(JSON.stringify({ alg: "none" }));
    const payload = btoa(JSON.stringify(["not", "an", "object"]));
    expect(decodeJwt(`${header}.${payload}.sig`)).toBeNull();
  });
});

describe("getExpiresAt", () => {
  it("converts exp (seconds) to milliseconds", () => {
    expect(getExpiresAt({ sub: "u", username: "u", exp: 1000 })).toBe(1_000_000);
  });

  it("returns null when exp is absent", () => {
    expect(getExpiresAt({ sub: "u", username: "u" })).toBeNull();
  });
});

describe("isExpired", () => {
  it("returns false when now is before expiresAt", () => {
    expect(isExpired({ sub: "u", username: "u", exp: 1000 }, 999_000)).toBe(false);
  });

  it("returns true when now is at or after expiresAt", () => {
    expect(isExpired({ sub: "u", username: "u", exp: 1000 }, 1_000_000)).toBe(true);
    expect(isExpired({ sub: "u", username: "u", exp: 1000 }, 1_000_001)).toBe(true);
  });

  it("returns false when there is no exp", () => {
    expect(isExpired({ sub: "u", username: "u" }, Date.now())).toBe(false);
  });
});
