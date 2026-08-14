import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";
import { renderWithProviders, screen, waitFor } from "../test/render";

function findSummary(): Promise<HTMLElement> {
  return screen.findByText((_content, element) =>
    element?.className === "font-mono text-[12.5px] text-fg-muted",
  );
}
import { InterviewError, type InterviewSessionSummary } from "@lib/interview-api";

const { listSessionsMock, deleteSessionMock } = vi.hoisted(() => ({
  listSessionsMock: vi.fn(),
  deleteSessionMock: vi.fn(),
}));

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return {
    ...actual,
    listSessions: listSessionsMock,
    deleteSession: deleteSessionMock,
  };
});

function makeSession(
  overrides: Partial<InterviewSessionSummary> = {},
): InterviewSessionSummary {
  return {
    id: "session-1",
    status: "completed",
    createdAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:30:00.000Z",
    vacancy: { seniorityLevel: "pleno", technologies: ["Node.js"] },
    repo: { fullName: "octocat/repo" },
    questionCount: 5,
    report: { overallScore: 80, adherenceScore: 70 },
    ...overrides,
  };
}

beforeEach(() => {
  listSessionsMock.mockReset();
  deleteSessionMock.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe("DashboardPage", () => {
  it("shows a spinner while loading", async () => {
    let resolve: (value: InterviewSessionSummary[]) => void = () => {};
    listSessionsMock.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    expect(
      screen.getByRole("status", { name: "Carregando suas entrevistas..." }),
    ).toBeInTheDocument();

    resolve([]);
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: "Carregando suas entrevistas..." }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows an error message when the fetch fails, without spinner or list", async () => {
    listSessionsMock.mockRejectedValue(new InterviewError("Falha ao buscar."));

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    expect(await screen.findByText("Falha ao buscar.")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Carregando suas entrevistas..." }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apagar entrevista" }),
    ).not.toBeInTheDocument();
  });

  it("shows EmptyTrail when the session list is empty", async () => {
    listSessionsMock.mockResolvedValue([]);

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    expect(await screen.findByText("Sua trilha começa aqui.")).toBeInTheDocument();
  });

  it("summary uses singular form for a single session and hides the score parts", async () => {
    listSessionsMock.mockResolvedValue([
      makeSession({ id: "s1", report: null }),
    ]);

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    const summary = await findSummary();
    expect(summary).toHaveTextContent("1 entrevista");
    expect(summary.textContent).not.toContain("entrevistas");
    expect(summary.textContent).not.toContain("média");
    expect(summary.textContent).not.toContain("melhor");
  });

  it("summary uses plural form and shows no score part when nothing is scored", async () => {
    listSessionsMock.mockResolvedValue([
      makeSession({ id: "s1", report: null }),
      makeSession({ id: "s2", report: null }),
    ]);

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    const summary = await findSummary();
    expect(summary).toHaveTextContent("2 entrevistas");
    expect(summary.textContent).not.toContain("média");
  });

  it("summary computes average and best score only over scored sessions", async () => {
    listSessionsMock.mockResolvedValue([
      makeSession({ id: "s1", report: { overallScore: 60, adherenceScore: 50 } }),
      makeSession({ id: "s2", report: { overallScore: 80, adherenceScore: 50 } }),
      makeSession({ id: "s3", report: null }),
    ]);

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    const summary = await findSummary();
    expect(summary).toHaveTextContent("3 entrevistas");
    expect(summary).toHaveTextContent("média 70/100");
    expect(summary).toHaveTextContent("melhor 80");
  });

  it("removes a deleted session from the local list without refetching", async () => {
    const user = userEvent.setup();
    listSessionsMock.mockResolvedValue([
      makeSession({ id: "s1", report: null }),
    ]);
    deleteSessionMock.mockResolvedValue(undefined);

    renderWithProviders(<DashboardPage />, { authPayload: {} });

    await findSummary();
    expect(listSessionsMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Apagar entrevista" }));
    await user.click(screen.getByRole("button", { name: "Apagar" }));

    await waitFor(() => expect(screen.getByText("Sua trilha começa aqui.")).toBeInTheDocument());
    expect(deleteSessionMock).toHaveBeenCalledWith("s1");
    expect(listSessionsMock).toHaveBeenCalledTimes(1);
  });
});
