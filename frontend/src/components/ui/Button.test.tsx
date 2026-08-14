import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";

import { Button, ButtonLink } from "./Button";

function DestinationStub() {
  return <div>destino</div>;
}

describe("Button", () => {
  it("defaults to type='button'", () => {
    render(<Button>Clique</Button>);
    expect(screen.getByRole("button", { name: "Clique" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("allows overriding the type", () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});

describe("ButtonLink", () => {
  it("prevents navigation and onClick when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ButtonLink to="/destino" disabled onClick={onClick}>
                Ir
              </ButtonLink>
            }
          />
          <Route path="/destino" element={<DestinationStub />} />
        </Routes>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Ir" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabIndex", "-1");

    await user.click(link);

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByText("destino")).not.toBeInTheDocument();
  });

  it("navigates and calls onClick when not disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ButtonLink to="/destino" onClick={onClick}>
                Ir
              </ButtonLink>
            }
          />
          <Route path="/destino" element={<DestinationStub />} />
        </Routes>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Ir" });
    expect(link).not.toHaveAttribute("aria-disabled", "true");

    await user.click(link);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("destino")).toBeInTheDocument();
  });
});
