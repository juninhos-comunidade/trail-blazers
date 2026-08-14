import { describe, expect, it } from "vitest";

import { HowItWorksSection } from "./HowItWorksSection";
import { renderWithProviders, screen } from "../../test/render";

describe("HowItWorksSection", () => {
  it("renders without crashing, with the section heading", () => {
    renderWithProviders(<HowItWorksSection />);

    expect(
      screen.getByRole("heading", { name: "Uma trilha com três marcos." }),
    ).toBeInTheDocument();
  });
});
