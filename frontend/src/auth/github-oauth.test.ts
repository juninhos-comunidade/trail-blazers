import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { consumeRedirectAfterLogin, exchangeLoginCode, startGithubOAuth } from "./github-oauth";
import { API_URL } from "../lib/env";
import { jsonResponse, mockFetchOnce, mockFetchRejectOnce } from "../test/fetch-mock";

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

describe("exchangeLoginCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the code and returns the access token", async () => {
    const fetchMock = mockFetchOnce(jsonResponse({ accessToken: "jwt-assinado" }));

    const token = await exchangeLoginCode("codigo-de-uso-unico");

    expect(token).toBe("jwt-assinado");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/auth/exchange`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "codigo-de-uso-unico" }),
      }),
    );
  });

  it("throws when the code is invalid or expired", async () => {
    mockFetchOnce(jsonResponse({ message: "Código de login inválido ou expirado." }, { status: 401 }));

    await expect(exchangeLoginCode("codigo-invalido")).rejects.toThrow(
      "Código de login inválido ou expirado.",
    );
  });

  it("throws on network failure", async () => {
    mockFetchRejectOnce();

    await expect(exchangeLoginCode("codigo-qualquer")).rejects.toThrow();
  });
});
