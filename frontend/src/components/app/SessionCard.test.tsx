import { describe, expect, it, vi, beforeEach } from "vitest";

import { SessionCard } from "./SessionCard";
import { renderWithProviders, screen, fireEvent, act } from "../../test/render";
import type { InterviewSessionSummary } from "@lib/interview-api";
import { deleteSession, InterviewError } from "@lib/interview-api";
import { clearVacancyDraft, readSessionDraft } from "@lib/interview-draft";

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

function makeSession(
  overrides: Partial<InterviewSessionSummary> = {},
): InterviewSessionSummary {
  return {
    id: "session-1",
    status: "in_progress",
    createdAt: "2026-01-15T10:00:00.000Z",
    completedAt: null,
    vacancy: { seniorityLevel: "mid", technologies: ["React", "Node"] },
    repo: null,
    questionCount: 6,
    report: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(deleteSession).mockReset();
  vi.mocked(readSessionDraft).mockReset().mockReturnValue(null);
  vi.mocked(clearVacancyDraft).mockReset();
});

describe("SessionCard", () => {
  describe("scoreColor", () => {
    it.each([
      [74, "var(--color-ember-text)"],
      [75, "var(--color-trail-text)"],
      [59, "var(--color-danger)"],
      [60, "var(--color-ember-text)"],
    ])("score %i renders color %s", (score, color) => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            report: { overallScore: score, adherenceScore: 50 },
          })}
          onDeleted={vi.fn()}
        />,
      );

      const scoreEl = screen.getByText(new RegExp(`^${score}`));
      expect(scoreEl).toHaveStyle({ color });
    });
  });

  describe("buildTitle", () => {
    it("no seniority and no stack -> 'Entrevista'", () => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            vacancy: { seniorityLevel: "unknown", technologies: [] },
          })}
          onDeleted={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Entrevista")).toBeInTheDocument();
    });

    it("seniority only", () => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            vacancy: { seniorityLevel: "senior", technologies: [] },
          })}
          onDeleted={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Sênior")).toBeInTheDocument();
    });

    it("stack only", () => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            vacancy: { seniorityLevel: "unknown", technologies: ["React", "Vue", "Angular"] },
          })}
          onDeleted={vi.fn()}
        />,
      );

      // only first 2 technologies used
      expect(screen.getByTitle("React, Vue")).toBeInTheDocument();
    });

    it("seniority and stack combined", () => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            vacancy: { seniorityLevel: "junior", technologies: ["Go"] },
          })}
          onDeleted={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Júnior — Go")).toBeInTheDocument();
    });

    it("appends repo full name when repo is present", () => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            vacancy: { seniorityLevel: "junior", technologies: ["Go"] },
            repo: { fullName: "octocat/hello" },
          })}
          onDeleted={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Júnior — Go — octocat/hello")).toBeInTheDocument();
    });
  });

  describe("truncate", () => {
    it("does not truncate a title exactly at the limit (80 chars)", () => {
      const stack = "A".repeat(80); // "unknown" seniority contributes nothing -> title === stack
      const session = makeSession({
        vacancy: { seniorityLevel: "unknown", technologies: [stack] },
      });
      expect(stack.length).toBe(80);

      renderWithProviders(<SessionCard session={session} onDeleted={vi.fn()} />);

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading.textContent).toBe(stack);
      expect(heading.textContent).not.toContain("…");
    });

    it("truncates a title one character over the limit", () => {
      const stack = "B".repeat(90);
      const session = makeSession({
        vacancy: { seniorityLevel: "unknown", technologies: [stack] },
      });

      renderWithProviders(<SessionCard session={session} onDeleted={vi.fn()} />);

      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading.textContent?.endsWith("…")).toBe(true);
      expect(heading.textContent?.length).toBe(80);
    });
  });

  describe("linkFor", () => {
    it("status in_progress links to the interview route", () => {
      renderWithProviders(
        <SessionCard session={makeSession({ status: "in_progress" })} onDeleted={vi.fn()} />,
      );

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/entrevista/conversa/session-1");
    });

    it.each(["preparing", "evaluating", "completed"] as const)(
      "status %s links to the report route",
      (status) => {
        renderWithProviders(
          <SessionCard session={makeSession({ status })} onDeleted={vi.fn()} />,
        );

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/entrevista/relatorio/session-1");
      },
    );
  });

  describe("StatusFooter", () => {
    it("shows adherence badge when report is present, regardless of status", () => {
      renderWithProviders(
        <SessionCard
          session={makeSession({
            status: "in_progress",
            report: { overallScore: 80, adherenceScore: 66.4 },
          })}
          onDeleted={vi.fn()}
        />,
      );

      expect(screen.getByText(/Aderência/)).toBeInTheDocument();
      expect(screen.getByText("66%")).toBeInTheDocument();
    });

    it("falls back to 'Em andamento' when no report and status is unmapped (e.g. 'preparing')", () => {
      renderWithProviders(
        <SessionCard session={makeSession({ status: "preparing", report: null })} onDeleted={vi.fn()} />,
      );

      expect(screen.getByText("Em andamento")).toBeInTheDocument();
    });

    it("shows 'Aguardando avaliação' for status evaluating without report", () => {
      renderWithProviders(
        <SessionCard session={makeSession({ status: "evaluating", report: null })} onDeleted={vi.fn()} />,
      );

      expect(screen.getByText("Aguardando avaliação")).toBeInTheDocument();
    });
  });

  describe("delete flow", () => {
    it("clicking delete shows the confirmation screen, and Cancelar returns to normal", () => {
      renderWithProviders(<SessionCard session={makeSession()} onDeleted={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: "Apagar entrevista" }));
      expect(screen.getByText("Apagar esta entrevista?")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.queryByText("Apagar esta entrevista?")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Apagar entrevista" })).toBeInTheDocument();
    });

    it("delete button preventDefault/stopPropagation instead of navigating the parent Link", () => {
      renderWithProviders(<SessionCard session={makeSession()} onDeleted={vi.fn()} />);

      const button = screen.getByRole("button", { name: "Apagar entrevista" });
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      act(() => {
        button.dispatchEvent(event);
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(screen.getByText("Apagar esta entrevista?")).toBeInTheDocument();
    });

    it("confirmDelete success calls deleteSession and onDeleted, and clears vacancy draft when matching", async () => {
      vi.mocked(deleteSession).mockResolvedValue(undefined);
      vi.mocked(readSessionDraft).mockReturnValue({ id: "session-1" });
      const onDeleted = vi.fn();

      renderWithProviders(<SessionCard session={makeSession({ id: "session-1" })} onDeleted={onDeleted} />);

      fireEvent.click(screen.getByRole("button", { name: "Apagar entrevista" }));
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
      await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith("session-1"));
      expect(deleteSession).toHaveBeenCalledWith("session-1");
      expect(clearVacancyDraft).toHaveBeenCalled();
    });

    it("confirmDelete does not clear vacancy draft when draft session id does not match", async () => {
      vi.mocked(deleteSession).mockResolvedValue(undefined);
      vi.mocked(readSessionDraft).mockReturnValue({ id: "other-session" });
      const onDeleted = vi.fn();

      renderWithProviders(<SessionCard session={makeSession({ id: "session-1" })} onDeleted={onDeleted} />);

      fireEvent.click(screen.getByRole("button", { name: "Apagar entrevista" }));
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
      await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith("session-1"));
      expect(clearVacancyDraft).not.toHaveBeenCalled();
    });

    it("confirmDelete does not clear vacancy draft when there is no draft", async () => {
      vi.mocked(deleteSession).mockResolvedValue(undefined);
      vi.mocked(readSessionDraft).mockReturnValue(null);
      const onDeleted = vi.fn();

      renderWithProviders(<SessionCard session={makeSession({ id: "session-1" })} onDeleted={onDeleted} />);

      fireEvent.click(screen.getByRole("button", { name: "Apagar entrevista" }));
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
      await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledWith("session-1"));
      expect(clearVacancyDraft).not.toHaveBeenCalled();
    });

    it("confirmDelete failure sets error, resets deleting, and re-enables buttons", async () => {
      const error = new InterviewError("Não conseguimos apagar esta entrevista.");
      vi.mocked(deleteSession).mockRejectedValue(error);
      const onDeleted = vi.fn();

      renderWithProviders(<SessionCard session={makeSession()} onDeleted={onDeleted} />);

      fireEvent.click(screen.getByRole("button", { name: "Apagar entrevista" }));
      fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
      await screen.findByText(error.detail);
      expect(onDeleted).not.toHaveBeenCalled();

      const deleteButton = screen.getByRole("button", { name: "Apagar" });
      const cancelButton = screen.getByRole("button", { name: "Cancelar" });
      expect(deleteButton).not.toBeDisabled();
      expect(cancelButton).not.toBeDisabled();
    });
  });
});
