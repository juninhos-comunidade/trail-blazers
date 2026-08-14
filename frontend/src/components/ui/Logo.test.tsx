import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Logo, LogoMark } from "./Logo";

describe("Logo", () => {
  it("renders the LogoMark svg without crashing", () => {
    const { container } = render(<LogoMark />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the full logo with the InterviewTrail wordmark", () => {
    const { container } = render(<Logo />);

    expect(container.querySelector(".font-display")?.textContent).toBe(
      "InterviewTrail",
    );
  });
});
