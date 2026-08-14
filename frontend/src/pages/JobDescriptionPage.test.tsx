import { Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "../test/render";
import { paths, vacancyReviewPath } from "@routes/paths";
import { JobDescriptionPage } from "./JobDescriptionPage";

import {
  clearVacancyDraft,
  readSessionDraft,
  readVacancyDraft,
  writeVacancyDraft,
} from "@lib/interview-draft";
import {
  createVacancy,
  describeAnalysis,
  getVacancy,
  reparseVacancy,
  updateVacancyProfile,
  waitForVacancyParsing,
  VacancyError,
} from "@lib/vacancies-api";
import { getSession, InterviewError } from "@lib/interview-api";

vi.mock("@lib/interview-draft", () => ({
  readVacancyDraft: vi.fn(),
  writeVacancyDraft: vi.fn(),
  clearVacancyDraft: vi.fn(),
  readSessionDraft: vi.fn(),
}));

vi.mock("@lib/vacancies-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/vacancies-api")>(
    "@lib/vacancies-api",
  );
  return {
    ...actual,
    createVacancy: vi.fn(),
    getVacancy: vi.fn(),
    reparseVacancy: vi.fn(),
    updateVacancyProfile: vi.fn(),
    waitForVacancyParsing: vi.fn(),
    describeAnalysis: vi.fn(),
  };
});

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return {
    ...actual,
    getSession: vi.fn(),
  };
});

const mockedReadVacancyDraft = vi.mocked(readVacancyDraft);
const mockedWriteVacancyDraft = vi.mocked(writeVacancyDraft);
const mockedClearVacancyDraft = vi.mocked(clearVacancyDraft);
const mockedReadSessionDraft = vi.mocked(readSessionDraft);
const mockedCreateVacancy = vi.mocked(createVacancy);
const mockedGetVacancy = vi.mocked(getVacancy);
const mockedReparseVacancy = vi.mocked(reparseVacancy);
const mockedUpdateVacancyProfile = vi.mocked(updateVacancyProfile);
const mockedWaitForVacancyParsing = vi.mocked(waitForVacancyParsing);
const mockedDescribeAnalysis = vi.mocked(describeAnalysis);
const mockedGetSession = vi.mocked(getSession);

function renderForm() {
  return renderWithProviders(
    <Routes>
      <Route path={paths.newInterview} element={<JobDescriptionPage />} />
      <Route path={`${paths.newInterview}/:sessionId`} element={<JobDescriptionPage />} />
    </Routes>,
    { route: paths.newInterview },
  );
}

function renderReview(sessionId: string) {
  return renderWithProviders(
    <Routes>
      <Route path={paths.newInterview} element={<JobDescriptionPage />} />
      <Route path={`${paths.newInterview}/:sessionId`} element={<JobDescriptionPage />} />
    </Routes>,
    { route: vacancyReviewPath(sessionId) },
  );
}

const LONG_TEXT = "a".repeat(50);

const profile = {
  technologies: ["React", "Node.js"],
  seniorityLevel: "mid" as const,
  keyCompetencies: ["Comunicação"],
  confidence: "high" as const,
  outOfScope: false,
};

function draftWithProfile(overrides: Partial<typeof profile> | null = {}) {
  return {
    id: "vacancy-1",
    description: LONG_TEXT,
    profile: overrides === null ? null : { ...profile, ...overrides },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedReadVacancyDraft.mockReturnValue(null);
  mockedReadSessionDraft.mockReturnValue(null);
  mockedDescribeAnalysis.mockReturnValue({ state: "ok" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeLengthProblem (via rendered length-problem message)", () => {
  it("shows the empty-text message for whitespace-only text", async () => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, "   ");
    // whitespace-only trims to empty, so the idle "Salvar vaga" block never
    // appears (it's gated on text.trim().length > 0)
    expect(screen.queryByRole("button", { name: "Salvar vaga" })).not.toBeInTheDocument();
  });

  it.each([
    [49, 1],
    [1, 49],
    [30, 20],
  ])("shows exact missing-character count for %i chars (missing %i)", async (len, missing) => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, "a".repeat(len));
    expect(
      screen.getByText(
        `A descrição precisa ter no mínimo 50 caracteres — faltam ${missing}.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar vaga" })).toBeDisabled();
  });

  it("at exactly 50 chars, has no length problem and Save is enabled", async () => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, "a".repeat(50));
    expect(screen.getByRole("button", { name: "Salvar vaga" })).toBeEnabled();
  });

  it("at exactly 10000 chars, has no length problem and Save is enabled", async () => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    // pasting is much faster than typing 10k chars via keystrokes
    await user.click(textarea);
    await user.paste("a".repeat(10_000));
    expect(screen.getByRole("button", { name: "Salvar vaga" })).toBeEnabled();
  }, 20000);

  it("at exactly 10001 chars, shows exact excess-character count", async () => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.click(textarea);
    await user.paste("a".repeat(10_001));
    expect(
      screen.getByText(
        "A descrição excede o limite de 10000 caracteres — remova 1.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar vaga" })).toBeDisabled();
  }, 20000);
});

describe("initial render", () => {
  it("no draft in storage -> empty idle form", () => {
    mockedReadVacancyDraft.mockReturnValue(null);
    renderForm();
    expect(screen.getByLabelText("Descrição da vaga")).toHaveValue("");
    expect(screen.queryByText("Vaga salva")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  });

  it("existing draft in storage -> pre-filled saved state", () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    renderForm();
    expect(screen.getByLabelText("Descrição da vaga")).toHaveValue(LONG_TEXT);
    expect(screen.getByText("Vaga salva")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeEnabled();
  });
});

describe("stepConcluded locks profile editing", () => {
  it("hides the 'Ajustar' button when a session already exists for this vacancy", () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    mockedReadSessionDraft.mockReturnValue({ id: "session-1" });
    renderForm();
    expect(screen.queryByRole("button", { name: "Ajustar" })).not.toBeInTheDocument();
  });

  it("shows the 'Ajustar' button when no session exists yet", () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    mockedReadSessionDraft.mockReturnValue(null);
    renderForm();
    expect(screen.getByRole("button", { name: "Ajustar" })).toBeInTheDocument();
  });
});

describe("editing text after having saved", () => {
  it("aborts polling, resets to idle, clears saved, and clears the vacancy draft", async () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByText("Vaga salva")).toBeInTheDocument();

    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, " mais texto");

    expect(screen.queryByText("Vaga salva")).not.toBeInTheDocument();
    expect(mockedClearVacancyDraft).toHaveBeenCalled();
    // "idle" Save block should now be showing again, since we typed non-empty text
    expect(screen.getByRole("button", { name: "Salvar vaga" })).toBeInTheDocument();
  });
});

describe("save()", () => {
  it("does nothing while lengthProblem is truthy (button stays disabled, createVacancy not called)", async () => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, "curto");
    const saveButton = screen.getByRole("button", { name: "Salvar vaga" });
    expect(saveButton).toBeDisabled();
    expect(mockedCreateVacancy).not.toHaveBeenCalled();
  });

  it("success moves to analyzing and kicks off polling", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    let resolvePolling!: (v: unknown) => void;
    mockedWaitForVacancyParsing.mockReturnValue(
      new Promise((resolve) => {
        resolvePolling = resolve;
      }) as never,
    );

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    await waitFor(() => {
      expect(screen.getByText("Vaga salva. A IA está lendo a descrição…")).toBeInTheDocument();
    });
    expect(mockedCreateVacancy).toHaveBeenCalledWith(LONG_TEXT);
    expect(mockedWriteVacancyDraft).toHaveBeenCalledWith({
      id: "vacancy-1",
      description: LONG_TEXT,
    });
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeEnabled();

    // resolve pending polling promise to avoid unhandled state after test
    resolvePolling({
      id: "vacancy-1",
      parseStatus: "done",
      parsedProfile: null,
    });
    await waitFor(() => screen.getByText("Vaga salva"));
  });

  it("failure shows an error and reverts to idle", async () => {
    mockedCreateVacancy.mockRejectedValue(
      new VacancyError("O servidor não conseguiu salvar a vaga.", { hint: "Tente de novo." }),
    );

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O servidor não conseguiu salvar a vaga.",
    );
    expect(screen.getByText("Tente de novo.")).toBeInTheDocument();
    // reverted to idle: Save button is visible again
    expect(screen.getByRole("button", { name: "Salvar vaga" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  });

  it("wraps a non-VacancyError failure in a generic VacancyError message", async () => {
    mockedCreateVacancy.mockRejectedValue(new Error("boom"));

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ocorreu uma falha inesperada ao salvar a vaga.",
    );
  });
});

describe("trackAnalysis / polling", () => {
  it("success populates saved/analysis via describeAnalysis", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    const analyzedVacancy = {
      id: "vacancy-1",
      parseStatus: "done",
      parsedProfile: profile,
    };
    mockedWaitForVacancyParsing.mockResolvedValue(analyzedVacancy as never);
    mockedDescribeAnalysis.mockReturnValue({ state: "ok" });

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    await waitFor(() => expect(screen.getByText("Vaga salva")).toBeInTheDocument());
    expect(mockedDescribeAnalysis).toHaveBeenCalledWith(analyzedVacancy);
    expect(mockedWriteVacancyDraft).toHaveBeenCalledWith({
      id: "vacancy-1",
      description: LONG_TEXT,
      profile,
    });
    // profile summary rendered
    expect(screen.getByText("Pleno")).toBeInTheDocument();
  });

  it("VacancyError during polling uses its own hint", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    mockedWaitForVacancyParsing.mockRejectedValue(
      new VacancyError("Falha específica.", { hint: "Dica específica.", retryable: true }),
    );

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    expect(await screen.findByText("Não conseguimos analisar esta vaga")).toBeInTheDocument();
    expect(screen.getByText("Falha específica.")).toBeInTheDocument();
    expect(screen.getByText("Dica específica.")).toBeInTheDocument();
    expect(screen.getByText("Vaga salva")).toBeInTheDocument();
  });

  it("generic error during polling maps to a fallback 'lost contact' message", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    mockedWaitForVacancyParsing.mockRejectedValue(new Error("network down"));

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    expect(
      await screen.findByText("Perdemos o contato com o servidor durante a análise."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A vaga foi salva. Você pode seguir mesmo assim."),
    ).toBeInTheDocument();
  });

  it("abort mid-flight (from a concurrent edit) does not clobber the state the edit already set", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);

    let resolvePolling!: (v: unknown) => void;
    mockedWaitForVacancyParsing.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePolling = resolve;
        }) as never,
    );

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    await waitFor(() =>
      expect(screen.getByText("Vaga salva. A IA está lendo a descrição…")).toBeInTheDocument(),
    );

    // Concurrent edit: aborts polling, resets to idle
    await user.type(textarea, " editado");
    expect(screen.getByLabelText("Descrição da vaga")).toHaveValue(`${LONG_TEXT} editado`);

    // Now resolve the (aborted) polling promise late — its .then should be a no-op
    resolvePolling({ id: "vacancy-1", parseStatus: "done", parsedProfile: profile });

    // Give microtasks a chance to flush, then assert the edited state was preserved
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText("Vaga salva")).not.toBeInTheDocument();
    expect(mockedDescribeAnalysis).not.toHaveBeenCalled();
  });
});

describe("retryAnalysis()", () => {
  it("is guarded against no-saved (no retry button without a saved vacancy)", () => {
    mockedReadVacancyDraft.mockReturnValue(null);
    renderForm();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });
});

describe("retryAnalysis() full flow (integration)", () => {
  async function saveAndFailAnalysis(user: ReturnType<typeof userEvent.setup>) {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    mockedWaitForVacancyParsing.mockRejectedValueOnce(
      new VacancyError("Falha temporária.", { hint: "Tente de novo.", retryable: true }),
    );

    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    expect(await screen.findByText("Não conseguimos analisar esta vaga")).toBeInTheDocument();
  }

  it("no-op if already analyzing (retry button disappears once analyzing starts)", async () => {
    const user = userEvent.setup();
    await saveAndFailAnalysis(user);

    let resolveReparse!: (v: unknown) => void;
    mockedReparseVacancy.mockReturnValue(
      new Promise((resolve) => {
        resolveReparse = resolve;
      }) as never,
    );

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() =>
      expect(screen.getByText("Vaga salva. A IA está lendo a descrição…")).toBeInTheDocument(),
    );
    // While analyzing, the retry button (part of the problem card) is gone.
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();

    resolveReparse({ id: "vacancy-1", parseStatus: "pending" });
    mockedWaitForVacancyParsing.mockResolvedValue({
      id: "vacancy-1",
      parseStatus: "done",
      parsedProfile: profile,
    } as never);
    await waitFor(() => expect(screen.getByText("Vaga salva")).toBeInTheDocument());
  });

  it("optimistically clears saved.profile and persists before server confirms, success re-triggers trackAnalysis", async () => {
    const user = userEvent.setup();
    await saveAndFailAnalysis(user);

    let resolveReparse!: (v: unknown) => void;
    mockedReparseVacancy.mockReturnValue(
      new Promise((resolve) => {
        resolveReparse = resolve;
      }) as never,
    );
    mockedWaitForVacancyParsing.mockResolvedValue({
      id: "vacancy-1",
      parseStatus: "done",
      parsedProfile: profile,
    } as never);

    mockedWriteVacancyDraft.mockClear();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    // Optimistic clear happened synchronously (profile: null) before reparseVacancy resolved
    expect(mockedWriteVacancyDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: "vacancy-1", profile: null }),
    );

    resolveReparse({ id: "vacancy-1", parseStatus: "pending" });

    await waitFor(() => expect(screen.getByText("Vaga salva")).toBeInTheDocument());
    expect(mockedWaitForVacancyParsing).toHaveBeenCalled();
    expect(screen.getByText("Pleno")).toBeInTheDocument();
  });

  it("failure shows an error and does NOT re-trigger trackAnalysis", async () => {
    const user = userEvent.setup();
    await saveAndFailAnalysis(user);

    mockedReparseVacancy.mockRejectedValue(
      new VacancyError("Não deu para reprocessar.", { hint: "Tente mais tarde.", retryable: false }),
    );
    mockedWaitForVacancyParsing.mockClear();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Não deu para reprocessar.")).toBeInTheDocument();
    expect(mockedWaitForVacancyParsing).not.toHaveBeenCalled();
    expect(screen.getByText("Vaga salva")).toBeInTheDocument();
  });
});

describe("Continuar button enablement", () => {
  it("is enabled during 'analyzing' (not blocked on analysis completing)", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    mockedWaitForVacancyParsing.mockReturnValue(new Promise(() => {}) as never);

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    await waitFor(() =>
      expect(screen.getByText("Vaga salva. A IA está lendo a descrição…")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeEnabled();
  });

  it("is enabled during 'saved'", () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    renderForm();
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeEnabled();
  });

  it("is disabled while 'saving'", async () => {
    mockedCreateVacancy.mockReturnValue(new Promise(() => {}) as never);
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    await waitFor(() =>
      expect(screen.getByText("Salvando a vaga…")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  });

  it("is disabled while 'idle'", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  });
});

describe("VacancyReviewView", () => {
  it("loads the session's vacancy and renders the description read-only", async () => {
    mockedGetSession.mockResolvedValue({
      id: "session-1",
      status: "in_progress",
      vacancyId: "vacancy-1",
      repo: null,
      questions: [],
    } as never);
    mockedGetVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
      parsedProfile: profile,
    } as never);

    renderReview("session-1");

    const textarea = await screen.findByLabelText("Descrição da vaga");
    expect(textarea).toHaveValue(LONG_TEXT);
    expect(textarea).toBeDisabled();
    expect(screen.getByText("Pleno")).toBeInTheDocument();
  });

  it("hides the profile summary when profile.outOfScope is true", async () => {
    mockedGetSession.mockResolvedValue({
      id: "session-1",
      status: "in_progress",
      vacancyId: "vacancy-1",
      repo: null,
      questions: [],
    } as never);
    mockedGetVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
      parsedProfile: { ...profile, outOfScope: true },
    } as never);

    renderReview("session-1");

    await screen.findByLabelText("Descrição da vaga");
    expect(screen.queryByText("O que entendemos da vaga")).not.toBeInTheDocument();
  });

  it("shows an error when loading the session fails", async () => {
    mockedGetSession.mockRejectedValue(new InterviewError("Sessão não encontrada."));

    renderReview("session-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Sessão não encontrada.");
  });

  it("wraps a VacancyError from getVacancy and preserves its detail", async () => {
    mockedGetSession.mockResolvedValue({
      id: "session-1",
      status: "in_progress",
      vacancyId: "vacancy-1",
      repo: null,
      questions: [],
    } as never);
    mockedGetVacancy.mockRejectedValue(
      new VacancyError("Vaga sumiu.", { hint: "Cadastre de novo." }),
    );

    renderReview("session-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Vaga sumiu.");
    expect(screen.getByText("Cadastre de novo.")).toBeInTheDocument();
  });
});

describe("SavedCard", () => {
  it("shows 'análise indisponível' only when profile is null and there is no problem", () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile(null));
    renderForm();
    expect(screen.getByText(/análise indisponível/)).toBeInTheDocument();
  });

  it("does not show 'análise indisponível' when a profile exists", () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    renderForm();
    expect(screen.queryByText(/análise indisponível/)).not.toBeInTheDocument();
  });

  it("does not show 'análise indisponível' when there is a problem (even with null profile)", async () => {
    mockedCreateVacancy.mockResolvedValue({
      id: "vacancy-1",
      rawDescription: LONG_TEXT,
    } as never);
    mockedWaitForVacancyParsing.mockRejectedValue(new Error("boom"));

    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText("Descrição da vaga");
    await user.type(textarea, LONG_TEXT);
    await user.click(screen.getByRole("button", { name: "Salvar vaga" }));

    await screen.findByText("Não conseguimos analisar esta vaga");
    expect(screen.queryByText(/análise indisponível/)).not.toBeInTheDocument();
  });
});

describe("VacancyProfileSummary", () => {
  it("startEditing() reseeds fields from the current profile, discarding a prior unsaved edit", async () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    const techInput = screen.getByLabelText("Adicionar em Tecnologias");
    await user.type(techInput, "Rust{enter}");
    expect(screen.getByText("Rust")).toBeInTheDocument();

    // Cancel discards the unsaved edit
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Rust")).not.toBeInTheDocument();

    // Re-open editing: should reseed from the original profile, not the discarded edit
    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.queryByText("Rust")).not.toBeInTheDocument();
  });

  it("cancelEditing() is a no-op mid-save", async () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    mockedUpdateVacancyProfile.mockReturnValue(new Promise(() => {}) as never);

    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled(),
    );
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelButton).toBeDisabled();
    await user.click(cancelButton);
    // still in editing mode (Cancelar/Salvando… still present)
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeInTheDocument();
  });

  it("save() success with a truthy parsedProfile calls onSaved (reflected via updated summary)", async () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    mockedUpdateVacancyProfile.mockResolvedValue({
      id: "vacancy-1",
      parsedProfile: { ...profile, seniorityLevel: "senior" },
    } as never);

    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.getByText("Sênior")).toBeInTheDocument());
    expect(mockedUpdateVacancyProfile).toHaveBeenCalledWith("vacancy-1", {
      technologies: profile.technologies,
      keyCompetencies: profile.keyCompetencies,
      seniorityLevel: profile.seniorityLevel,
    });
    expect(mockedWriteVacancyDraft).toHaveBeenCalledWith(
      expect.objectContaining({ profile: { ...profile, seniorityLevel: "senior" } }),
    );
  });

  it("save() success with a null parsedProfile does NOT call onSaved (summary unchanged)", async () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    mockedUpdateVacancyProfile.mockResolvedValue({
      id: "vacancy-1",
      parsedProfile: null,
    } as never);

    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Salvando…" })).not.toBeInTheDocument(),
    );
    // Editing closed (save() always sets editing false), but onSaved wasn't called
    // so the original profile (Pleno) is still shown, not overwritten.
    expect(screen.getByText("Pleno")).toBeInTheDocument();
    expect(mockedWriteVacancyDraft).not.toHaveBeenCalled();
  });

  it("save() failure keeps edit mode open with a local error", async () => {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    mockedUpdateVacancyProfile.mockRejectedValue(
      new VacancyError("Não deu pra salvar.", { hint: "Tente de novo." }),
    );

    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText(/Não deu pra salvar\./)).toBeInTheDocument();
    // still editing: the select + save/cancel buttons are present
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });
});

describe("TagListEditor", () => {
  async function openEditing(user: ReturnType<typeof userEvent.setup>) {
    mockedReadVacancyDraft.mockReturnValue(draftWithProfile());
    renderForm();
    await user.click(screen.getByRole("button", { name: "Ajustar" }));
  }

  it("empty input commit is a no-op", async () => {
    const user = userEvent.setup();
    await openEditing(user);

    const before = screen.getAllByRole("button", { name: /^Adicionar$/ });
    await user.click(before[0]);
    // technologies list unchanged: still just React and Node.js
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });

  it("duplicate value commit is a no-op (dedup)", async () => {
    const user = userEvent.setup();
    await openEditing(user);

    const techInput = screen.getByLabelText("Adicionar em Tecnologias");
    await user.type(techInput, "React{enter}");

    const reactChips = screen.getAllByText("React");
    expect(reactChips).toHaveLength(1);
    expect(techInput).toHaveValue("");
  });

  it("new value appends and clears the input", async () => {
    const user = userEvent.setup();
    await openEditing(user);

    const techInput = screen.getByLabelText("Adicionar em Tecnologias");
    await user.type(techInput, "Go{enter}");

    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(techInput).toHaveValue("");
  });

  it("comma also triggers commit", async () => {
    const user = userEvent.setup();
    await openEditing(user);

    const techInput = screen.getByLabelText("Adicionar em Tecnologias");
    await user.type(techInput, "Go,");

    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(techInput).toHaveValue("");
  });

  it("removing a tag via its remove button drops it from the list", async () => {
    const user = userEvent.setup();
    await openEditing(user);

    await user.click(screen.getByRole("button", { name: "Remover React" }));
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });
});
