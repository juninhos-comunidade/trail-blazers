import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders its children without crashing, defaulting to the trail tone", () => {
    render(<Eyebrow>Rótulo</Eyebrow>);

    const eyebrow = screen.getByText("Rótulo");
    expect(eyebrow).toBeInTheDocument();
    expect(eyebrow.className).toContain("text-trail-text");
  });

  it("applies the ember tone classes when tone='ember'", () => {
    render(<Eyebrow tone="ember">Rótulo</Eyebrow>);

    const eyebrow = screen.getByText("Rótulo");
    expect(eyebrow.className).toContain("text-ember-text");
    expect(eyebrow.className).not.toContain("text-trail-text");
  });
});
