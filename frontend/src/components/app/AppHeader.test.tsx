import { describe, expect, it } from "vitest";

import { AppHeader } from "./AppHeader";
import { paths } from "../../routes/paths";
import { renderWithProviders, screen } from "../../test/render";

describe("AppHeader", () => {
  it("shows a truncated label and hides ThemeToggle/UserMenu when label is provided", () => {
    renderWithProviders(<AppHeader label="entrevistatrail.com/x" />, {
      authPayload: {},
    });

    expect(screen.getByText("entrevistatrail.com/x")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sair/i }),
    ).not.toBeInTheDocument();
  });

  it("shows ThemeToggle and UserMenu when no label is provided", () => {
    renderWithProviders(<AppHeader />, { authPayload: {} });

    expect(
      screen.getByRole("button", { name: /sair/i }),
    ).toBeInTheDocument();
  });

  it("logo always links to paths.dashboard", () => {
    renderWithProviders(<AppHeader />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", paths.dashboard);
  });
});
