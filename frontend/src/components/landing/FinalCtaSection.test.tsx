import { describe, expect, it } from "vitest";

import { FinalCtaSection } from "./FinalCtaSection";
import { renderWithProviders, screen } from "../../test/render";

describe("FinalCtaSection", () => {
  it("renders without crashing, with the section heading and a sign-in CTA", () => {
    renderWithProviders(<FinalCtaSection />);

    expect(
      screen.getByRole("heading", { name: "Descubra suas lacunas antes do recrutador." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar com GitHub/ })).toBeInTheDocument();
  });
});
