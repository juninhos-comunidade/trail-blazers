import { describe, expect, it } from "vitest";

import { LandingFooter } from "./LandingFooter";
import { renderWithProviders, screen } from "../../test/render";

describe("LandingFooter", () => {
  it("renders without crashing, with the logo and the team credit line", () => {
    const { container } = renderWithProviders(<LandingFooter />);

    // The wordmark text is split across a text node ("Interview") and a
    // nested <span> ("Trail"), so match on the wordmark span's full text.
    expect(container.querySelector(".font-display")?.textContent).toBe(
      "InterviewTrail",
    );
    expect(screen.getByText(/Equipe Trail Blazers/)).toBeInTheDocument();
  });
});
