import { describe, expect, it } from "vitest";

import { LandingFooter } from "./LandingFooter";
import { renderWithProviders, screen } from "../../test/render";

describe("LandingFooter", () => {
  it("renders without crashing, with the logo and the team credit line", () => {
    const { container } = renderWithProviders(<LandingFooter />);

    expect(container.querySelector(".font-display")?.textContent).toBe(
      "InterviewTrail",
    );
    expect(screen.getByText(/Equipe Trail Blazers/)).toBeInTheDocument();
  });
});
