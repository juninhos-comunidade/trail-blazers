import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders an img when src is provided", () => {
    render(<Avatar username="octocat" src="https://example.com/a.png" />);

    const img = screen.getByAltText("Avatar de octocat");
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "https://example.com/a.png");
  });

  it("falls back to initials when the image fails to load", () => {
    render(<Avatar username="octocat" src="https://example.com/broken.png" />);

    const img = screen.getByAltText("Avatar de octocat");
    fireEvent.error(img);

    expect(screen.queryByAltText("Avatar de octocat")).not.toBeInTheDocument();
    expect(screen.getByText("o")).toBeInTheDocument();
  });

  it("falls back to initials directly when src is missing", () => {
    render(<Avatar username="octocat" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("o")).toBeInTheDocument();
  });

  it("handles an empty username without crashing", () => {
    const { container } = render(<Avatar username="" />);

    const fallback = container.querySelector("span[aria-hidden='true']");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveTextContent("");
  });
});
