import { describe, expect, it, vi } from "vitest";

import { RepositoryCard } from "./RepoCard";
import { renderWithProviders, screen, act, fireEvent } from "../../test/render";
import type { RepoSummary } from "@lib/repositories-api";

function makeRepo(overrides: Partial<RepoSummary> = {}): RepoSummary {
  return {
    id: 1,
    owner: "octocat",
    name: "hello-world",
    description: "A description",
    language: "TypeScript",
    visibility: "public",
    ...overrides,
  };
}

describe("RepositoryCard", () => {
  it("known language shows the correct color", () => {
    renderWithProviders(
      <RepositoryCard repository={makeRepo({ language: "TypeScript" })} />,
    );

    const dot = document.querySelector("i");
    expect(dot).toHaveStyle({ background: "#3178c6" });
  });

  it("unknown language falls back to the default color", () => {
    renderWithProviders(
      <RepositoryCard repository={makeRepo({ language: "COBOL" })} />,
    );

    const dot = document.querySelector("i");
    expect(dot).toHaveStyle({ background: "var(--color-slate-400)" });
  });

  it("does not call onToggle when locked and clicked", async () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <RepositoryCard repository={makeRepo()} locked onToggle={onToggle} />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("calls onToggle(repository) when not locked and clicked", () => {
    const onToggle = vi.fn();
    const repo = makeRepo();
    renderWithProviders(<RepositoryCard repository={repo} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(repo);
  });

  it("calls toggle() and preventDefault on Space/Enter keydown, ignores other keys", () => {
    const onToggle = vi.fn();
    renderWithProviders(<RepositoryCard repository={makeRepo()} onToggle={onToggle} />);

    const checkbox = screen.getByRole("checkbox");

    checkbox.focus();
    // Space key
    act(() => {
      checkbox.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
      );
    });
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Enter key
    act(() => {
      checkbox.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(onToggle).toHaveBeenCalledTimes(2);

    // Other key: ignored
    act(() => {
      checkbox.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }),
      );
    });
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("remains focusable but non-interactive when locked", () => {
    renderWithProviders(<RepositoryCard repository={makeRepo()} locked />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("tabIndex", "0");
    expect(checkbox).toHaveAttribute("aria-disabled", "true");
  });

  it("shows check icon and selection ring when selected", () => {
    renderWithProviders(<RepositoryCard repository={makeRepo()} selected />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("falls back to 'Sem descrição no GitHub.' when description is null", () => {
    renderWithProviders(
      <RepositoryCard repository={makeRepo({ description: null })} />,
    );

    expect(screen.getByText("Sem descrição no GitHub.")).toBeInTheDocument();
  });

  it("shows 'Sem linguagem' badge when language is null", () => {
    renderWithProviders(<RepositoryCard repository={makeRepo({ language: null })} />);

    expect(screen.getByText("Sem linguagem")).toBeInTheDocument();
  });

  it.each([
    ["private", "Privado"],
    ["public", "Público"],
  ] as const)("visibility %s renders label %s", (visibility, label) => {
    renderWithProviders(<RepositoryCard repository={makeRepo({ visibility })} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
