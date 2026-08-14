import { Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { InterviewFlowLayout } from "./InterviewFlowLayout";
import { renderWithProviders, screen, waitFor, act } from "../../test/render";
import { paths, vacancyReviewPath, repoReviewPath, interviewPath, reportPath } from "@routes/paths";
import type { InterviewSession, SessionStatus } from "@lib/interview-api";

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return { ...actual, getSession: vi.fn() };
});

vi.mock("@lib/interview-draft", () => ({
  readSessionDraft: vi.fn(() => null),
  readVacancyDraft: vi.fn(() => null),
}));

import { getSession } from "@lib/interview-api";
import { readSessionDraft, readVacancyDraft } from "@lib/interview-draft";

function makeSession(status: SessionStatus): InterviewSession {
  return {
    id: "s1",
    status,
    vacancyId: "v1",
    repo: null,
    questions: [],
  };
}

let navigateRef: ((path: string) => void) | null = null;

function NavCapture() {
  navigateRef = useNavigate();
  return null;
}

function renderFlow(route: string) {
  return renderWithProviders(
    <>
      <NavCapture />
      <Routes>
        <Route element={<InterviewFlowLayout />}>
          <Route path={paths.newInterview} element={<div>tela-vaga</div>} />
          <Route path={`${paths.newInterview}/:sessionId`} element={<div>tela-vaga-review</div>} />
          <Route path={paths.repoChooser} element={<div>tela-repos</div>} />
          <Route path={`${paths.repoChooser}/:sessionId`} element={<div>tela-repos-review</div>} />
          <Route path={paths.interview} element={<div>tela-conversa</div>} />
          <Route path={`${paths.interview}/:sessionId`} element={<div>tela-conversa-session</div>} />
          <Route path={paths.report} element={<div>tela-relatorio</div>} />
          <Route path={`${paths.report}/:sessionId`} element={<div>tela-relatorio-session</div>} />
        </Route>
      </Routes>
    </>,
    { route },
  );
}

function stepperLabel(): string | null {
  return screen.getByRole("list").getAttribute("aria-label");
}

function numberVisible(number: string): boolean {
  return screen.queryByText(number) !== null;
}

beforeEach(() => {
  navigateRef = null;
  vi.mocked(getSession).mockReset().mockResolvedValue(makeSession("in_progress"));
  vi.mocked(readSessionDraft).mockReset().mockReturnValue(null);
  vi.mocked(readVacancyDraft).mockReset().mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InterviewFlowLayout", () => {
  describe("stepFromPathname", () => {
    it.each([
      [`${paths.report}/abc123`, 4],
      [`${paths.interview}/abc123`, 3],
      [`${paths.repoChooser}/abc123`, 2],
      [`${paths.newInterview}/abc123`, 1],
      [paths.newInterview, 1],
    ])("pathname %s maps to step %i", async (route, step) => {
      renderFlow(route);
      await waitFor(() => expect(stepperLabel()).toContain(`Etapa ${step} de 4`));
    });
  });

  it("URL sessionId param takes priority over readSessionDraft()", async () => {
    vi.mocked(readSessionDraft).mockReturnValue({ id: "draft-id" });
    vi.mocked(getSession).mockResolvedValue(makeSession("in_progress"));

    renderFlow(`${paths.interview}/url-id`);

    await waitFor(() => expect(getSession).toHaveBeenCalledWith("url-id"));
    expect(getSession).not.toHaveBeenCalledWith("draft-id");
  });

  it("without a resolvable sessionId, the effect does not fetch and status is not reset when navigating away from a session route", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession("completed"));

    renderFlow(`${paths.interview}/s1`);
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(numberVisible("04")).toBe(false));

    act(() => navigateRef!(paths.newInterview));

    await waitFor(() => expect(stepperLabel()).toContain("Etapa 1 de 4"));
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(numberVisible("02")).toBe(false);
    expect(numberVisible("03")).toBe(false);
    expect(numberVisible("04")).toBe(false);
    expect(numberVisible("01")).toBe(true);
  });

  it("fetch success updates status from the response", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession("completed"));

    renderFlow(vacancyReviewPath("s1"));

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(numberVisible("04")).toBe(false));
    expect(numberVisible("02")).toBe(false);
    expect(numberVisible("03")).toBe(false);
  });

  it("fetch error sets status to null", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("boom"));

    renderFlow(`${paths.interview}/s1`);

    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(numberVisible("04")).toBe(true));
    expect(numberVisible("01")).toBe(false);
    expect(numberVisible("02")).toBe(false);
  });

  it("a late response after navigating away does not update state (cancelled guard, no act warnings)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolveSession!: (session: InterviewSession) => void;
    const pending = new Promise<InterviewSession>((resolve) => {
      resolveSession = resolve;
    });
    vi.mocked(getSession).mockReturnValue(pending);

    renderFlow(`${paths.interview}/s1`);
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));

    act(() => navigateRef!(paths.newInterview));
    await waitFor(() => expect(stepperLabel()).toContain("Etapa 1 de 4"));

    await act(async () => {
      resolveSession(makeSession("completed"));
      await pending;
    });

    expect(numberVisible("02")).toBe(true);
    expect(numberVisible("03")).toBe(true);
    expect(numberVisible("04")).toBe(true);

    const actWarning = consoleError.mock.calls.some((call) =>
      String(call[0]).includes("not wrapped in act"),
    );
    expect(actWarning).toBe(false);
  });

  describe("interviewDone / reportDone", () => {
    it.each([
      ["evaluating", true],
      ["completed", true],
      ["in_progress", false],
      ["preparing", false],
    ] as const)("status %s -> interviewDone %s (report step href availability)", async (status, expected) => {
      vi.mocked(getSession).mockResolvedValue(makeSession(status));

      renderFlow(vacancyReviewPath("s1")); // current = 1, step 4 is not current

      await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));

      if (expected) {
        await waitFor(() =>
          expect(
            screen.getByRole("link", { name: /Ver o que foi preenchido em: Relatório/i }),
          ).toHaveAttribute("href", reportPath("s1")),
        );
      } else {
        await waitFor(() => expect(numberVisible("04")).toBe(true));
        expect(
          screen.queryByRole("link", { name: /Ver o que foi preenchido em: Relatório/i }),
        ).not.toBeInTheDocument();
      }
    });
  });

  describe("statusCompletedStep cascade", () => {
    it("tier 0: no vacancy, no session -> nothing marked done", async () => {
      renderFlow(paths.newInterview);

      await waitFor(() => expect(stepperLabel()).toContain("Etapa 1 de 4"));
      expect(getSession).not.toHaveBeenCalled();
      expect(numberVisible("02")).toBe(true);
      expect(numberVisible("03")).toBe(true);
      expect(numberVisible("04")).toBe(true);
    });

    it("tier 1: has vacancy, no session -> step 1 done when viewed from step 2", async () => {
      vi.mocked(readVacancyDraft).mockReturnValue({ id: "v1", description: "desc" });

      renderFlow(paths.repoChooser);

      await waitFor(() => expect(stepperLabel()).toContain("Etapa 2 de 4"));
      expect(getSession).not.toHaveBeenCalled();
      expect(numberVisible("01")).toBe(false); // step 1 done -> check icon, no "01"
      expect(numberVisible("02")).toBe(true); // step 2 active
      expect(numberVisible("03")).toBe(true);
      expect(numberVisible("04")).toBe(true);
    });

    it("tier 2: has session, status in_progress/preparing -> steps 1-2 done when viewed from step 3", async () => {
      vi.mocked(getSession).mockResolvedValue(makeSession("in_progress"));

      renderFlow(interviewPath("s1"));

      await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(numberVisible("04")).toBe(true));
      expect(numberVisible("01")).toBe(false);
      expect(numberVisible("02")).toBe(false);
      expect(numberVisible("03")).toBe(true); // current, active
    });

    it("tier 3: interviewDone (evaluating), reportDone false -> steps 1-3 done when viewed from step 4", async () => {
      vi.mocked(getSession).mockResolvedValue(makeSession("evaluating"));

      renderFlow(reportPath("s1"));

      await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(numberVisible("01")).toBe(false));
      expect(numberVisible("02")).toBe(false);
      expect(numberVisible("03")).toBe(false);
      expect(numberVisible("04")).toBe(true); // current, active
    });

    it("tier 4: reportDone (completed) -> all non-current steps done, even viewed from an earlier step", async () => {
      vi.mocked(getSession).mockResolvedValue(makeSession("completed"));

      renderFlow(repoReviewPath("s1")); // current = 2

      await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(numberVisible("04")).toBe(false));
      expect(numberVisible("01")).toBe(false);
      expect(numberVisible("02")).toBe(true); // current, active, never "done"
      expect(numberVisible("03")).toBe(false);
    });
  });

  it("maxCompletedStep floors at current - 1 even with no status loaded yet", async () => {
    renderFlow(paths.interview); // current = 3, no :sessionId param

    await waitFor(() => expect(stepperLabel()).toContain("Etapa 3 de 4"));
    expect(getSession).not.toHaveBeenCalled();
    expect(numberVisible("01")).toBe(false);
    expect(numberVisible("02")).toBe(false);
    expect(numberVisible("03")).toBe(true); // current
    expect(numberVisible("04")).toBe(true);
  });
});
