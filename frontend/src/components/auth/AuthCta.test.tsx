import { describe, expect, it } from "vitest";

import { AuthCta } from "./AuthCta";
import { renderWithProviders, screen } from "../../test/render";

describe("AuthCta", () => {
  it("renders dashboard CTA when authenticated", () => {
    renderWithProviders(<AuthCta />, { authPayload: {} });

    const link = screen.getByRole("link", { name: /ir para o dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("renders GitHub sign-in CTA when not authenticated", () => {
    renderWithProviders(<AuthCta />);

    const link = screen.getByRole("link", { name: /entrar com github/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login");
  });
});
