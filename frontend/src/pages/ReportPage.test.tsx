import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Route, Routes } from "react-router-dom";

import { renderWithProviders, screen, waitFor } from "../test/render";
import { ReportPage } from "./ReportPage";
import { paths, reportPath, interviewPath } from "@routes/paths";
import type { InterviewReport, InterviewSession } from "@lib/interview-api";
import { InterviewError } from "@lib/interview-api";
import { VacancyError } from "@lib/vacancies-api";

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return {
    ...actual,
    getSession: vi.fn(),
    getReport: vi.fn(),
    generateReport: vi.fn(),
  };
});

vi.mock("@lib/vacancies-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/vacancies-api")>(
    "@lib/vacancies-api",
  );
  return {
    ...actual,
    getVacancy: vi.fn(),
  };
});

vi.mock("@lib/interview-draft", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-draft")>(
    "@lib/interview-draft",
  );
  return {
    ...actual,
    readVacancyDraft: vi.fn(),
    readRepositoryDraft: vi.fn(),
    readSessionDraft: vi.fn(),
    deriveRepositoryDraft: vi.fn(),
  };
});

import { getSession, getReport, generateReport } from "@lib/interview-api";
import { getVacancy } from "@lib/vacancies-api";
import {
  readVacancyDraft,
  readRepositoryDraft,
  readSessionDraft,
  deriveRepositoryDraft,
} from "@lib/interview-draft";

const mockGetSession = vi.mocked(getSession);
const mockGetReport = vi.mocked(getReport);
const mockGenerateReport = vi.mocked(generateReport);
const mockGetVacancy = vi.mocked(getVacancy);
const mockReadVacancyDraft = vi.mocked(readVacancyDraft);
const mockReadRepositoryDraft = vi.mocked(readRepositoryDraft);
const mockReadSessionDraft = vi.mocked(readSessionDraft);
const mockDeriveRepositoryDraft = vi.mocked(deriveRepositoryDraft);

function makeReport(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    sessionId: "sess-1",
    overallScore: 85,
    adherenceScore: 70,
    adherenceNotes: [],
    dimensionScores: [
      { label: "Lógica", score: 80 },
      { label: "Comunicação", score: 60 },
    ],
    strengths: [{ title: "Boa lógica", text: "Explicou bem." }],
    gaps: [{ title: "Testes", text: "Faltou cobertura." }],
    recommendations: [{ title: "Pratique", text: "Faça mais exercícios." }],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: "hist-1",
    status: "completed",
    vacancyId: "vac-1",
    repo: null,
    questions: [],
    ...overrides,
  };
}

function renderFresh() {
  return renderWithProviders(
    <Routes>
      <Route path={paths.report} element={<ReportPage />} />
    </Routes>,
    { route: paths.report },
  );
}

function renderHistorical(sessionId: string) {
  return renderWithProviders(
    <Routes>
      <Route path={`${paths.report}/:sessionId`} element={<ReportPage />} />
    </Routes>,
    { route: reportPath(sessionId) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadVacancyDraft.mockReturnValue({
    id: "vac-1",
    description: "Uma vaga qualquer que tem uma descrição comprida o suficiente.",
    profile: {
      technologies: ["React", "Node"],
      seniorityLevel: "mid",
      keyCompetencies: [],
      confidence: "high",
      outOfScope: false,
    },
  });
  mockReadRepositoryDraft.mockReturnValue({
    owner: "octocat",
    name: "hello-world",
    language: "TypeScript",
    fileCount: 10,
    omittedCount: 0,
    topFiles: [],
  });
  mockReadSessionDraft.mockReturnValue({ id: "sess-1" });
  mockDeriveRepositoryDraft.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportPage - guard redirect", () => {
  it("redirects to newInterview when fresh flow has no vacancy draft", async () => {
    mockReadVacancyDraft.mockReturnValue(null);

    renderWithProviders(
      <Routes>
        <Route path={paths.report} element={<ReportPage />} />
        <Route path={paths.newInterview} element={<div>Nova Entrevista Page</div>} />
      </Routes>,
      { route: paths.report },
    );

    expect(await screen.findByText("Nova Entrevista Page")).toBeInTheDocument();
  });

  it("redirects to newInterview when fresh flow has no session draft", async () => {
    mockReadSessionDraft.mockReturnValue(null);

    renderWithProviders(
      <Routes>
        <Route path={paths.report} element={<ReportPage />} />
        <Route path={paths.newInterview} element={<div>Nova Entrevista Page</div>} />
      </Routes>,
      { route: paths.report },
    );

    expect(await screen.findByText("Nova Entrevista Page")).toBeInTheDocument();
  });
});

describe("ReportPage - historical load", () => {
  it("throws respostas_pendentes client-side without calling getReport when session is in_progress", async () => {
    mockGetSession.mockResolvedValue(makeSession({ status: "in_progress" }));
    mockGetVacancy.mockResolvedValue({
      id: "vac-1",
      userId: "u1",
      rawDescription: "desc",
      parsedProfile: null,
      parseStatus: "done",
      parseFailureReason: null,
      parsingCompleted: true,
      createdAt: new Date().toISOString(),
    });

    renderWithProviders(
      <Routes>
        <Route path={`${paths.report}/:sessionId`} element={<ReportPage />} />
        <Route path={`${paths.interview}/:sessionId`} element={<div>Interview Page</div>} />
      </Routes>,
      { route: reportPath("hist-1") },
    );

    expect(await screen.findByText("Interview Page")).toBeInTheDocument();
    expect(mockGetReport).not.toHaveBeenCalled();
  });

  it("navigates to the interview page (respostas_pendentes redirect) instead of a generic error screen", async () => {
    mockGetSession.mockResolvedValue(makeSession({ status: "in_progress" }));
    mockGetVacancy.mockResolvedValue({
      id: "vac-1",
      userId: "u1",
      rawDescription: "desc",
      parsedProfile: null,
      parseStatus: "done",
      parseFailureReason: null,
      parsingCompleted: true,
      createdAt: new Date().toISOString(),
    });

    renderWithProviders(
      <Routes>
        <Route path={`${paths.report}/:sessionId`} element={<ReportPage />} />
        <Route path={interviewPath(":sessionId")} element={<div>Interview Page</div>} />
      </Routes>,
      { route: reportPath("hist-1") },
    );

    expect(await screen.findByText("Interview Page")).toBeInTheDocument();
    expect(screen.queryByText(/tentar novamente/i)).not.toBeInTheDocument();
  });

  it("calls generateReport when getReport returns null (historical)", async () => {
    mockGetSession.mockResolvedValue(makeSession({ status: "completed" }));
    mockGetVacancy.mockResolvedValue({
      id: "vac-1",
      userId: "u1",
      rawDescription: "desc",
      parsedProfile: null,
      parseStatus: "done",
      parseFailureReason: null,
      parsingCompleted: true,
      createdAt: new Date().toISOString(),
    });
    mockGetReport.mockResolvedValue(null);
    mockGenerateReport.mockResolvedValue(makeReport());

    renderHistorical("hist-1");

    await waitFor(() => expect(mockGenerateReport).toHaveBeenCalledWith("hist-1"));
    expect(await screen.findByText(/Você mandou muito bem\./)).toBeInTheDocument();
  });

  it("converts VacancyError thrown during load into an InterviewError-shaped error", async () => {
    mockGetSession.mockResolvedValue(makeSession({ status: "completed" }));
    mockGetVacancy.mockRejectedValue(
      new VacancyError("Vaga não encontrada.", { hint: "Tente outra vaga.", retryable: false }),
    );

    renderHistorical("hist-1");

    expect(await screen.findByText("Vaga não encontrada.")).toBeInTheDocument();
    expect(screen.getByText("Tente outra vaga.")).toBeInTheDocument();
    expect(screen.queryByText(/tentar novamente/i)).not.toBeInTheDocument();
  });
});

describe("ReportPage - fresh load", () => {
  it("calls generateReport when getReport returns null (fresh)", async () => {
    mockGetReport.mockResolvedValue(null);
    mockGenerateReport.mockResolvedValue(makeReport());

    renderFresh();

    await waitFor(() => expect(mockGenerateReport).toHaveBeenCalledWith("sess-1"));
    expect(await screen.findByText(/Você mandou muito bem\./)).toBeInTheDocument();
  });

  it("does not call generateReport when getReport already returns a report", async () => {
    mockGetReport.mockResolvedValue(makeReport());

    renderFresh();

    expect(await screen.findByText(/Você mandou muito bem\./)).toBeInTheDocument();
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("only fetches once even across re-renders (load-once guard)", async () => {
    mockGetReport.mockResolvedValue(makeReport());

    const { rerender } = renderFresh();

    await screen.findByText(/Você mandou muito bem\./);

    rerender(
      <Routes>
        <Route path={paths.report} element={<ReportPage />} />
      </Routes>,
    );

    await waitFor(() => {
      expect(mockGetReport).toHaveBeenCalledTimes(1);
    });
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("generic errors from the API surface a fallback message", async () => {
    mockGetReport.mockRejectedValue(new Error("boom"));

    renderFresh();

    expect(await screen.findByText("Não conseguimos gerar o relatório.")).toBeInTheDocument();
  });

  it("retry() re-triggers load()", async () => {
    mockGetReport
      .mockRejectedValueOnce(new InterviewError("Falhou a primeira vez.", { retryable: true }))
      .mockResolvedValueOnce(makeReport());

    const user = (await import("@testing-library/user-event")).default.setup();
    renderFresh();

    expect(await screen.findByText("Falhou a primeira vez.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(await screen.findByText(/Você mandou muito bem\./)).toBeInTheDocument();
    expect(mockGetReport).toHaveBeenCalledTimes(2);
  });
});

describe("ReportPage - headline/summary tiers at score boundaries", () => {
  it.each([
    [79, "Você está mais perto do que pensa."],
    [80, "Você mandou muito bem."],
    [59, "Dá pra melhorar, e o caminho está claro."],
    [60, "Você está mais perto do que pensa."],
    [39, "Ainda há bastante chão pela frente — e está tudo bem."],
    [40, "Dá pra melhorar, e o caminho está claro."],
  ])("score %d renders headline %s", async (score, headline) => {
    mockGetReport.mockResolvedValue(makeReport({ overallScore: score }));

    renderFresh();

    expect(await screen.findByText(headline)).toBeInTheDocument();
  });

  it("score 45 hits different tiers for headline and summary", async () => {
    mockGetReport.mockResolvedValue(makeReport({ overallScore: 45 }));

    renderFresh();

    // buildHeadline(45) -> "Dá pra melhorar..." tier (40-59)
    expect(
      await screen.findByText("Dá pra melhorar, e o caminho está claro."),
    ).toBeInTheDocument();
    // buildSummary(45) -> lowest tier (< 60), since buildSummary has only 3 tiers
    expect(
      screen.getByText(
        "Ainda há lacunas importantes. Veja abaixo o que fortalecer antes da próxima simulação.",
      ),
    ).toBeInTheDocument();
  });
});

describe("ReportPage - score ring extremes", () => {
  it("renders without crashing at score 0", async () => {
    mockGetReport.mockResolvedValue(makeReport({ overallScore: 0 }));

    renderFresh();

    expect(await screen.findByText("0")).toBeInTheDocument();
  });

  it("renders without crashing at score 100", async () => {
    mockGetReport.mockResolvedValue(makeReport({ overallScore: 100 }));

    renderFresh();

    expect(await screen.findByText("100")).toBeInTheDocument();
  });
});

describe("ReportPage - AdherenceCard", () => {
  it("renders with 0 notes", async () => {
    mockGetReport.mockResolvedValue(makeReport({ adherenceScore: 50, adherenceNotes: [] }));

    renderFresh();

    expect(await screen.findByText("Aderência do portfólio à vaga")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("renders with 1 note", async () => {
    mockGetReport.mockResolvedValue(
      makeReport({
        adherenceScore: 70,
        adherenceNotes: [{ title: "Ponto 1", text: "Detalhe 1." }],
      }),
    );

    renderFresh();

    expect(await screen.findByText("Ponto 1")).toBeInTheDocument();
    expect(screen.getByText("Detalhe 1.")).toBeInTheDocument();
  });

  it("renders with 2 notes", async () => {
    mockGetReport.mockResolvedValue(
      makeReport({
        adherenceScore: 70,
        adherenceNotes: [
          { title: "Ponto 1", text: "Detalhe 1." },
          { title: "Ponto 2", text: "Detalhe 2." },
        ],
      }),
    );

    renderFresh();

    expect(await screen.findByText("Ponto 1")).toBeInTheDocument();
    expect(await screen.findByText("Ponto 2")).toBeInTheDocument();
  });

  it("ignores a 3rd note if present", async () => {
    mockGetReport.mockResolvedValue(
      makeReport({
        adherenceScore: 70,
        adherenceNotes: [
          { title: "Ponto 1", text: "Detalhe 1." },
          { title: "Ponto 2", text: "Detalhe 2." },
          { title: "Ponto 3", text: "Detalhe 3." },
        ],
      }),
    );

    renderFresh();

    expect(await screen.findByText("Ponto 1")).toBeInTheDocument();
    expect(screen.getByText("Ponto 2")).toBeInTheDocument();
    expect(screen.queryByText("Ponto 3")).not.toBeInTheDocument();
  });
});
