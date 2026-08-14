import { describe, expect, it } from "vitest";

import { HeroSection } from "./HeroSection";
import { renderWithProviders, screen } from "../../test/render";

describe("HeroSection", () => {
  it("renders without crashing, with the hero heading", () => {
    renderWithProviders(<HeroSection />);

    expect(
      screen.getByRole("heading", { name: /Chegue preparado para a entrevista técnica/ }),
    ).toBeInTheDocument();
  });
});
