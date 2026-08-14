import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Alert } from "./Alert";

describe("Alert", () => {
  it("defaults to warning tone and always has role=alert", () => {
    render(<Alert>Aviso</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Aviso");
    expect(alert.className).toContain("color-warning");
  });

  it("applies danger tone classes when tone='danger'", () => {
    render(<Alert tone="danger">Erro</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("color-danger");
    expect(alert.className).not.toContain("color-warning");
  });
});
