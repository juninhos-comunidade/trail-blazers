import { describe, expect, it, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";

import { ThemeToggle } from "./ThemeToggle";
import { renderWithProviders } from "../../test/render";

function seedTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("shows sun icon and 'Tema claro' label when theme is dark", () => {
    seedTheme("dark");
    renderWithProviders(<ThemeToggle />);

    expect(screen.getByText("Tema claro")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /alternar para o tema claro/i }),
    ).toBeInTheDocument();
  });

  it("shows moon icon and 'Tema escuro' label when theme is light", () => {
    seedTheme("light");
    renderWithProviders(<ThemeToggle />);

    expect(screen.getByText("Tema escuro")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /alternar para o tema escuro/i }),
    ).toBeInTheDocument();
  });

  it("flips the visible theme label when clicked", async () => {
    seedTheme("dark");
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    expect(screen.getByText("Tema claro")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Tema escuro")).toBeInTheDocument();
    expect(screen.queryByText("Tema claro")).not.toBeInTheDocument();
  });
});
