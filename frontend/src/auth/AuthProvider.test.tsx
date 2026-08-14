import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { TOKEN_STORAGE_KEY } from "./auth-context";
import { signTestToken } from "../test/jwt-helpers";

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth precisa estar dentro de um <AuthProvider>.",
    );
  });
});

describe("AuthProvider - initial session restore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unauthenticated when there is no stored token", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("restores the session from a valid stored token", () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, signTestToken({ sub: "u1", username: "octocat" }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({
      id: "u1",
      username: "octocat",
      email: undefined,
      avatarUrl: undefined,
    });
  });

  it("clears an expired stored token", () => {
    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      signTestToken({ exp: Math.floor(Date.now() / 1000) - 100 }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("clears an undecodable stored token", () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "not-a-jwt");
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });
});

describe("AuthProvider - signIn/signOut", () => {
  it("signIn with a valid token authenticates and returns true", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let returned = false;
    act(() => {
      returned = result.current.signIn(signTestToken({ sub: "u2", username: "dev" }));
    });

    expect(returned).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe("dev");
    expect(result.current.sessionEndReason).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
  });

  it("signIn with an invalid token stays unauthenticated, sets reason 'invalid' and returns false", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    let returned = true;
    act(() => {
      returned = result.current.signIn("garbage");
    });

    expect(returned).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionEndReason).toBe("invalid");
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("signOut without a reason clears the session with sessionEndReason null", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.signIn(signTestToken()));

    act(() => result.current.signOut());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionEndReason).toBeNull();
  });

  it("signOut('expired') sets sessionEndReason to 'expired'", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.signOut("expired"));
    expect(result.current.sessionEndReason).toBe("expired");
  });

  it("clearSessionEndReason resets the reason to null", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.signOut("expired"));
    act(() => result.current.clearSessionEndReason());
    expect(result.current.sessionEndReason).toBeNull();
  });
});

describe("AuthProvider - automatic expiry", () => {
  it("signs the user out automatically once the token expires", async () => {
    vi.useFakeTimers();
    const expiresInSeconds = 5;
    const token = signTestToken({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.signIn(token));
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(expiresInSeconds * 1000 + 50);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionEndReason).toBe("expired");
    vi.useRealTimers();
  });

  it("does not fire the stale sign-out after re-authenticating with a new session", async () => {
    vi.useFakeTimers();
    const shortLived = signTestToken({ exp: Math.floor(Date.now() / 1000) + 2 });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.signIn(shortLived));

    const longLived = signTestToken({
      sub: "u9",
      exp: Math.floor(Date.now() / 1000) + 1000,
    });
    act(() => result.current.signIn(longLived));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isAuthenticated).toBe(true);
    vi.useRealTimers();
  });
});
