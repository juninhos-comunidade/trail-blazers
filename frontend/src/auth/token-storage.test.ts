import { afterEach, describe, expect, it, vi } from "vitest";

import { clearToken, readToken, writeToken } from "./token-storage";
import { TOKEN_STORAGE_KEY } from "./auth-context";

describe("token-storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes and reads back the token", () => {
    writeToken("abc.def.ghi");
    expect(readToken()).toBe("abc.def.ghi");
  });

  it("clears the token", () => {
    writeToken("abc.def.ghi");
    clearToken();
    expect(readToken()).toBeNull();
  });

  it("readToken returns null when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readToken()).toBeNull();
  });

  it("writeToken does not throw when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeToken("x")).not.toThrow();
  });

  it("clearToken does not throw when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearToken()).not.toThrow();
  });

  it("uses the shared TOKEN_STORAGE_KEY", () => {
    writeToken("xyz");
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe("xyz");
  });
});
