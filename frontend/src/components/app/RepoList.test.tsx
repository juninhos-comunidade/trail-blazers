import { describe, expect, it, vi } from "vitest";

import { RepositoryList } from "./RepoList";
import { renderWithProviders, screen, fireEvent } from "../../test/render";
import type { RepoSummary } from "@lib/repositories-api";

function makeRepos(count: number): RepoSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    owner: "octocat",
    name: `repo-${index + 1}`,
    description: null,
    language: null,
    visibility: "public" as const,
  }));
}

describe("RepositoryList", () => {
  it("pageCount = max(1, ceil(length/6)); no pagination controls when only 1 page", () => {
    renderWithProviders(
      <RepositoryList
        repositories={makeRepos(3)}
        selectedIds={[]}
        limit={3}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows pagination controls when pageCount > 1 and slices repositories per page", () => {
    renderWithProviders(
      <RepositoryList
        repositories={makeRepos(8)}
        selectedIds={[]}
        limit={8}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("repo-1")).toBeInTheDocument();
    expect(screen.getByText("repo-6")).toBeInTheDocument();
    expect(screen.queryByText("repo-7")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("repo-7")).toBeInTheDocument();
    expect(screen.getByText("repo-8")).toBeInTheDocument();
    expect(screen.queryByText("repo-1")).not.toBeInTheDocument();
  });

  it("self-corrects currentPage when the list shrinks below the current page range", () => {
    const { rerender } = renderWithProviders(
      <RepositoryList
        repositories={makeRepos(13)}
        selectedIds={[]}
        limit={13}
        onToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
    expect(screen.getByText("repo-13")).toBeInTheDocument();

    rerender(
      <RepositoryList
        repositories={makeRepos(8)}
        selectedIds={[]}
        limit={8}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("repo-7")).toBeInTheDocument();
    expect(screen.getByText("repo-8")).toBeInTheDocument();
    expect(screen.getByText(/página 2 de 2/i)).toBeInTheDocument();
  });

  it("locks unselected cards when full (selectedIds.length >= limit) but keeps selected clickable", () => {
    renderWithProviders(
      <RepositoryList
        repositories={makeRepos(2)}
        selectedIds={[1]}
        limit={1}
        onToggle={vi.fn()}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const selected = checkboxes.find((c) => c.getAttribute("aria-checked") === "true");
    const unselected = checkboxes.find((c) => c.getAttribute("aria-checked") === "false");

    expect(selected?.getAttribute("aria-disabled")).toBeNull();
    expect(unselected?.getAttribute("aria-disabled")).toBe("true");
  });
});
