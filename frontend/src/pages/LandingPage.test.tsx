import { describe, expect, it } from "vitest";

import { LandingPage } from "./LandingPage";
import { renderWithProviders, screen } from "../test/render";

describe("LandingPage", () => {
  it("renders without crashing, with the hero heading and a CTA to sign in", () => {
    renderWithProviders(<LandingPage />);

    expect(
      screen.getByRole("heading", { name: /Chegue preparado para a entrevista técnica/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Entrar com GitHub|Entrar/).length).toBeGreaterThan(0);
  });
});
