import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("renders with default size and label", () => {
    render(<Spinner />);

    const status = screen.getByRole("status", { name: "Carregando" });
    expect(status).toBeInTheDocument();
    expect(status).toHaveStyle({ width: "44px", height: "44px" });
  });

  it("allows overriding size and label", () => {
    render(<Spinner size={20} label="Aguarde" />);

    const status = screen.getByRole("status", { name: "Aguarde" });
    expect(status).toHaveStyle({ width: "20px", height: "20px" });
  });
});
