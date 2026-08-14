import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { Pagination } from "./Pagination";

function renderPagination(page: number, pageCount: number, onChange = vi.fn()) {
  render(
    <Pagination
      page={page}
      pageCount={pageCount}
      total={pageCount * 6}
      rangeStart={1}
      rangeEnd={6}
      onChange={onChange}
      ariaLabel="Paginação"
    />,
  );
  return onChange;
}

function pageNumbers() {
  return screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label"))
    .filter((label): label is string => !!label && /^Página \d+$/.test(label))
    .map((label) => Number(label.replace("Página ", "")));
}

describe("Pagination", () => {
  it("clamps the window at the start (page=1) without going negative", () => {
    renderPagination(1, 10);
    expect(pageNumbers()).toEqual([1, 2, 3]);
  });

  it("clamps the window at the end (page=pageCount)", () => {
    renderPagination(10, 10);
    expect(pageNumbers()).toEqual([8, 9, 10]);
  });

  it("collapses the window when pageCount=1", () => {
    renderPagination(1, 1);
    expect(pageNumbers()).toEqual([1]);
  });

  it("collapses the window when pageCount=2 (page=1)", () => {
    renderPagination(1, 2);
    expect(pageNumbers()).toEqual([1, 2]);
  });

  it("collapses the window when pageCount=2 (page=2)", () => {
    renderPagination(2, 2);
    expect(pageNumbers()).toEqual([1, 2]);
  });

  it("centers the window when page is in the middle of a large pageCount", () => {
    renderPagination(10, 20);
    expect(pageNumbers()).toEqual([9, 10, 11]);
  });

  it("disables the previous button on the first page", () => {
    renderPagination(1, 10);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
  });

  it("disables the next button on the last page", () => {
    renderPagination(10, 10);
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled();
  });

  it("marks only the active page with aria-current='page'", () => {
    renderPagination(5, 10);
    const current = screen.getByRole("button", { name: "Página 5" });
    expect(current).toHaveAttribute("aria-current", "page");

    const others = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-label") === "Página 4");
    expect(others[0]).not.toHaveAttribute("aria-current");
  });
});
