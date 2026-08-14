import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { consumeRedirectAfterLogin, startGithubOAuth } from "./github-oauth";
import { API_URL } from "../lib/env";

const REDIRECT_KEY = "interviewtrail:redirect-after-login";

describe("startGithubOAuth", () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // @ts-expect-error -- substituição controlada para testar a navegação
    delete window.location;
    (window as unknown as { location: Location }).location = { href: "" } as Location;
  });

  afterEach(() => {
    (window as unknown as { location: Location }).location = originalLocation;
  });

  it("redirects to the backend github auth endpoint", () => {
    startGithubOAuth();
    expect(window.location.href).toBe(`${API_URL}/auth/github`);
  });

  it("stores redirectTo in sessionStorage when provided", () => {
    startGithubOAuth("/dashboard");
    expect(sessionStorage.getItem(REDIRECT_KEY)).toBe("/dashboard");
  });

  it("does not store anything when redirectTo is omitted", () => {
    startGithubOAuth();
    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });
});

describe("consumeRedirectAfterLogin", () => {
  it("returns and removes a stored path starting with /", () => {
    sessionStorage.setItem(REDIRECT_KEY, "/dashboard");
    expect(consumeRedirectAfterLogin()).toBe("/dashboard");
    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it("returns null for an absolute external URL (open-redirect guard)", () => {
    sessionStorage.setItem(REDIRECT_KEY, "https://evil.example.com");
    expect(consumeRedirectAfterLogin()).toBeNull();
    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it("returns null when nothing was stored", () => {
    expect(consumeRedirectAfterLogin()).toBeNull();
  });
});
