import { describe, expect, it } from "vitest";

import { LandingHeader } from "./LandingHeader";
import { renderWithProviders, screen } from "../../test/render";

describe("LandingHeader", () => {
  it("renders without crashing, with the logo and sign-in link when unauthenticated", () => {
    const { container } = renderWithProviders(<LandingHeader />);

    // The wordmark text is split across a text node ("Interview") and a
    // nested <span> ("Trail"), so match on the wordmark span's full text.
    expect(container.querySelector(".font-display")?.textContent).toBe(
      "InterviewTrail",
    );
    expect(screen.getByRole("link", { name: /Entrar/ })).toBeInTheDocument();
  });

  it("renders the user menu instead of the sign-in link when authenticated", () => {
    renderWithProviders(<LandingHeader />, { authPayload: {} });

    expect(screen.queryByRole("link", { name: /^Entrar$/ })).not.toBeInTheDocument();
  });
});
