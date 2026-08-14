import { describe, expect, it, vi } from "vitest";

import { SessionList } from "./SessionList";
import { renderWithProviders, screen, fireEvent } from "../../test/render";
import type { InterviewSessionSummary } from "@lib/interview-api";

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return { ...actual, deleteSession: vi.fn() };
});

vi.mock("@lib/interview-draft", () => ({
  readSessionDraft: vi.fn(() => null),
  clearVacancyDraft: vi.fn(),
}));

function makeSessions(count: number): InterviewSessionSummary[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `session-${index + 1}`,
    status: "in_progress" as const,
    createdAt: new Date().toISOString(),
    completedAt: null,
    vacancy: { seniorityLevel: "mid", technologies: ["React"] },
    repo: null,
    questionCount: 5,
    report: null,
  }));
}

describe("SessionList", () => {
  it("no pagination controls when only 1 page", () => {
    renderWithProviders(
      <SessionList sessions={makeSessions(3)} onSessionDeleted={vi.fn()} />,
      { route: "/" },
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("self-corrects currentPage when the list shrinks below the current page range", () => {
    const { rerender } = renderWithProviders(
      <SessionList sessions={makeSessions(13)} onSessionDeleted={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
    expect(screen.getByText(/página 3 de 3/i)).toBeInTheDocument();

    rerender(
      <SessionList sessions={makeSessions(8)} onSessionDeleted={vi.fn()} />,
    );

    expect(screen.getByText(/página 2 de 2/i)).toBeInTheDocument();
  });

  it("passes onSessionDeleted through to each SessionCard's delete flow", async () => {
    const onSessionDeleted = vi.fn();
    const sessions = makeSessions(1);
    renderWithProviders(
      <SessionList sessions={sessions} onSessionDeleted={onSessionDeleted} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apagar entrevista" }));
    expect(
      screen.getByText("Apagar esta entrevista?"),
    ).toBeInTheDocument();
  });
});
