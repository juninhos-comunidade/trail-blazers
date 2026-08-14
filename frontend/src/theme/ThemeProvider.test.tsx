import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./useTheme";
import { THEME_STORAGE_KEY } from "./theme-context";

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("useTheme", () => {
  it("throws when used outside a ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme precisa estar dentro de um <ThemeProvider>.",
    );
  });

  it("returns theme and toggleTheme inside the provider", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme === "dark" || result.current.theme === "light").toBe(true);
    expect(typeof result.current.toggleTheme).toBe("function");
  });
});

describe("ThemeProvider", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses DEFAULT_THEME when dataset.theme is unset", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("uses the existing dataset.theme when valid", () => {
    document.documentElement.dataset.theme = "light";
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("light");
  });

  it("falls back to DEFAULT_THEME when dataset.theme is invalid", () => {
    document.documentElement.dataset.theme = "purple";
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("toggleTheme flips dark <-> light and persists to localStorage + dataset", () => {
    document.documentElement.dataset.theme = "dark";
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("does not throw when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(() => act(() => result.current.toggleTheme())).not.toThrow();
  });
});
