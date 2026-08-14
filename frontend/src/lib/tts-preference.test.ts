import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readTtsPreference, useTtsPreference, writeTtsPreference } from "./tts-preference";

describe("readTtsPreference / writeTtsPreference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when nothing is stored", () => {
    expect(readTtsPreference()).toBe(false);
  });

  it("returns true only when the stored value is exactly '1'", () => {
    writeTtsPreference(true);
    expect(readTtsPreference()).toBe(true);

    writeTtsPreference(false);
    expect(readTtsPreference()).toBe(false);
  });

  it("returns false when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readTtsPreference()).toBe(false);
  });
});

describe("useTtsPreference", () => {
  it("initial state reflects readTtsPreference()", () => {
    writeTtsPreference(true);
    const { result } = renderHook(() => useTtsPreference());
    expect(result.current[0]).toBe(true);
  });

  it("set() updates state and persists the new value", () => {
    const { result } = renderHook(() => useTtsPreference());

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(readTtsPreference()).toBe(true);
  });
});
