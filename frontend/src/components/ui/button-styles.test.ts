import { describe, expect, it } from "vitest";

import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";

const variants: ButtonVariant[] = ["primary", "ember", "secondary", "ghost", "danger"];
const sizes: ButtonSize[] = ["sm", "md", "lg"];

describe("buttonStyles", () => {
  for (const variant of variants) {
    for (const size of sizes) {
      it(`returns non-empty classes for variant=${variant} size=${size}`, () => {
        expect(() => buttonStyles(variant, size)).not.toThrow();

        const result = buttonStyles(variant, size);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain("disabled:opacity-45");
      });
    }
  }

  it("includes an extra className when provided", () => {
    const result = buttonStyles("primary", "md", "extra-class");
    expect(result).toContain("extra-class");
  });

  it("omits nothing when className is undefined", () => {
    const result = buttonStyles("secondary", "lg");
    expect(result).toContain("border-border");
  });
});
