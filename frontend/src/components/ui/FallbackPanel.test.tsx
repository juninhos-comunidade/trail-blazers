import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FallbackPanel } from "./FallbackPanel";

describe("FallbackPanel", () => {
  it("sets role='alert' when tone='danger'", () => {
    render(<FallbackPanel title="Erro" detail="Algo deu errado" tone="danger" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not set role='alert' for other tones", () => {
    render(<FallbackPanel title="Vazio" detail="Nada aqui" tone="neutral" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not set role='alert' when tone is omitted (defaults to neutral)", () => {
    render(<FallbackPanel title="Vazio" detail="Nada aqui" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders neither hint nor action when not provided", () => {
    render(<FallbackPanel title="Título" detail="Detalhe" />);
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument();
    expect(screen.getByText("Título")).toBeInTheDocument();
    expect(screen.getByText("Detalhe")).toBeInTheDocument();
  });

  it("renders hint only when provided without action", () => {
    render(<FallbackPanel title="Título" detail="Detalhe" hint="Dica útil" />);
    expect(screen.getByText("Dica útil")).toBeInTheDocument();
  });

  it("renders action only when provided without hint", () => {
    render(
      <FallbackPanel
        title="Título"
        detail="Detalhe"
        action={<button type="button">Tentar de novo</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
  });

  it("renders both hint and action when both provided", () => {
    render(
      <FallbackPanel
        title="Título"
        detail="Detalhe"
        hint="Dica útil"
        action={<button type="button">Tentar de novo</button>}
      />,
    );
    expect(screen.getByText("Dica útil")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
  });
});
