import { describe, expect, it } from "vitest";

import { EmptyTrail } from "./EmptyTrail";
import { paths } from "../../routes/paths";
import { renderWithProviders, screen } from "../../test/render";

describe("EmptyTrail", () => {
  it("renders a CTA pointing to paths.newInterview", () => {
    renderWithProviders(<EmptyTrail />);

    const cta = screen.getByRole("link", {
      name: /criar minha primeira entrevista/i,
    });
    expect(cta).toHaveAttribute("href", paths.newInterview);
  });
});
