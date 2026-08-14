import { describe, expect, it } from "vitest";

import { API_URL } from "./env";

describe("API_URL", () => {
  it("has no trailing slash", () => {
    expect(API_URL.endsWith("/")).toBe(false);
  });

  it("is a non-empty string", () => {
    expect(typeof API_URL).toBe("string");
    expect(API_URL.length).toBeGreaterThan(0);
  });
});
