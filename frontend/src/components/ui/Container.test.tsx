import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Container } from "./Container";

describe("Container", () => {
  it("renders its children without crashing", () => {
    render(<Container>conteúdo</Container>);

    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("merges a custom className with the defaults", () => {
    render(<Container className="custom-class">conteúdo</Container>);

    const container = screen.getByText("conteúdo");
    expect(container.className).toContain("custom-class");
    expect(container.className).toContain("mx-auto");
  });
});
