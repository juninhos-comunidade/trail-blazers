import { describe, expect, it } from "vitest";

import { UnderConstructionPage } from "./UnderConstructionPage";
import { renderWithProviders, screen } from "../test/render";

describe("UnderConstructionPage", () => {
  it("renders without crashing, with the key message and a CTA back to the landing page", () => {
    renderWithProviders(<UnderConstructionPage />);

    expect(
      screen.getByText("Esta etapa da trilha ainda está sendo construída."),
    ).toBeInTheDocument();

    const backLink = screen.getByRole("link", { name: "Voltar ao início" });
    expect(backLink).toHaveAttribute("href", "/");
  });
});
