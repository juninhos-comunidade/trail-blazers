import { describe, expect, it } from "vitest";

import { DifferenceSection } from "./DifferenceSection";
import { renderWithProviders, screen } from "../../test/render";

describe("DifferenceSection", () => {
  it("renders without crashing, with the section heading", () => {
    renderWithProviders(<DifferenceSection />);

    expect(
      screen.getByRole("heading", { name: "Não é mais um quiz de algoritmos." }),
    ).toBeInTheDocument();
  });
});
