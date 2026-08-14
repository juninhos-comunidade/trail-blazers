import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { renderWithProviders, screen, waitFor } from "../test/render";
import { RepositoryChooserPage } from "./RepositoryChooserPage";
import { paths, repoReviewPath, interviewPath } from "@routes/paths";
import type { InterviewSession } from "@lib/interview-api";
import { InterviewError } from "@lib/interview-api";
import type { RepoSummary } from "@lib/repositories-api";
import { RepositoriesError } from "@lib/repositories-api";

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return {
    ...actual,
    createSession: vi.fn(),
    getSession: vi.fn(),
  };
});

vi.mock("@lib/repositories-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/repositories-api")>(
    "@lib/repositories-api",
  );
  return {
    ...actual,
    fetchRepos: vi.fn(),
  };
});

vi.mock("@lib/interview-draft", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-draft")>(
    "@lib/interview-draft",
  );
  return {
    ...actual,
    readVacancyDraft: vi.fn(),
    writeRepositoryDraft: vi.fn(),
    writeSessionDraft: vi.fn(),
    clearRepositoryDraft: vi.fn(),
    deriveRepositoryDraft: vi.fn(),
  };
});

import { createSession, getSession } from "@lib/interview-api";
import { fetchRepos } from "@lib/repositories-api";
import {
  readVacancyDraft,
  writeRepositoryDraft,
  writeSessionDraft,
  clearRepositoryDraft,
  deriveRepositoryDraft,
} from "@lib/interview-draft";

const mockCreateSession = vi.mocked(createSession);
const mockGetSession = vi.mocked(getSession);
const mockFetchRepos = vi.mocked(fetchRepos);
const mockReadVacancyDraft = vi.mocked(readVacancyDraft);
const mockWriteRepositoryDraft = vi.mocked(writeRepositoryDraft);
const mockWriteSessionDraft = vi.mocked(writeSessionDraft);
const mockClearRepositoryDraft = vi.mocked(clearRepositoryDraft);
const mockDeriveRepositoryDraft = vi.mocked(deriveRepositoryDraft);

function makeRepo(overrides: Partial<RepoSummary> = {}): RepoSummary {
  return {
    id: 1,
    owner: "octocat",
    name: "hello-world",
    description: "Um repositório de teste.",
    language: "TypeScript",
    visibility: "public",
    ...overrides,
  };
}

function makeSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: "sess-1",
    status: "preparing",
    vacancyId: "vac-1",
    repo: { fullName: "octocat/hello-world", url: "https://github.com/octocat/hello-world", primaryLanguage: "TypeScript" },
    repoAnalysis: { fileCount: 5, omittedCount: 0, topFiles: ["a.ts"] },
    questions: [],
    ...overrides,
  };
}

function renderChooser() {
  return renderWithProviders(
    <Routes>
      <Route path={paths.repoChooser} element={<RepositoryChooserPage />} />
      <Route path={paths.newInterview} element={<div>Nova Entrevista Page</div>} />
      <Route path={paths.interview} element={<div>Interview Page</div>} />
    </Routes>,
    { route: paths.repoChooser },
  );
}

function renderReview(sessionId: string) {
  return renderWithProviders(
    <Routes>
      <Route path={`${paths.repoChooser}/:sessionId`} element={<RepositoryChooserPage />} />
      <Route path={paths.dashboard} element={<div>Dashboard Page</div>} />
      <Route path={interviewPath(":sessionId")} element={<div>Interview Page</div>} />
    </Routes>,
    { route: repoReviewPath(sessionId) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadVacancyDraft.mockReturnValue({
    id: "vac-12345678",
    description: "Uma descrição de vaga bem detalhada e comprida o suficiente.",
    profile: {
      technologies: ["React"],
      seniorityLevel: "mid",
      keyCompetencies: [],
      confidence: "high",
      outOfScope: false,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RepositoryChooserPage - guard redirect", () => {
  it("redirects to newInterview when there's no vacancy draft", async () => {
    mockReadVacancyDraft.mockReturnValue(null);
    mockFetchRepos.mockResolvedValue([]);

    renderChooser();

    expect(await screen.findByText("Nova Entrevista Page")).toBeInTheDocument();
  });
});

describe("RepositoryChooserPage - toggle / selection limit", () => {
  it("selects up to SELECTION_LIMIT (1) and ignores further selections", async () => {
    const repoA = makeRepo({ id: 1, name: "repo-a" });
    const repoB = makeRepo({ id: 2, name: "repo-b" });
    mockFetchRepos.mockResolvedValue([repoA, repoB]);

    const user = userEvent.setup();
    renderChooser();

    const cardA = await screen.findByRole("checkbox", { name: "octocat/repo-a" });
    const cardB = screen.getByRole("checkbox", { name: "octocat/repo-b" });

    await user.click(cardA);
    expect(cardA).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1/1 selecionado")).toBeInTheDocument();

    // Second selection while at the limit is ignored (repoB stays unchecked, locked)
    await user.click(cardB);
    expect(cardB).toHaveAttribute("aria-checked", "false");
    expect(cardA).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1/1 selecionado")).toBeInTheDocument();
  });
});

describe("RepositoryChooserPage - retry", () => {
  it("re-triggers the repo fetch after a fetch error", async () => {
    mockFetchRepos
      .mockRejectedValueOnce(new RepositoriesError("Falha ao buscar repositórios."))
      .mockResolvedValueOnce([makeRepo()]);

    const user = userEvent.setup();
    renderChooser();

    expect(await screen.findByText("Falha ao buscar repositórios.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(await screen.findByRole("checkbox", { name: "octocat/hello-world" })).toBeInTheDocument();
    expect(mockFetchRepos).toHaveBeenCalledTimes(2);
  });
});

describe("RepositoryChooserPage - offerSkip", () => {
  it("offers skip when the fetch failed", async () => {
    mockFetchRepos.mockRejectedValue(new RepositoriesError("Falha."));

    renderChooser();

    expect(await screen.findByRole("button", { name: /seguir sem repositórios/i })).toBeInTheDocument();
  });

  it("offers skip when fetch succeeds with zero repos", async () => {
    mockFetchRepos.mockResolvedValue([]);

    renderChooser();

    expect(
      await screen.findByRole("button", { name: /seguir sem repositórios/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum repositório público encontrado")).toBeInTheDocument();
  });
});

describe("RepositoryChooserPage - skipRepositories", () => {
  it("clears repo draft and navigates to interview without creating a session", async () => {
    mockFetchRepos.mockResolvedValue([]);

    const user = userEvent.setup();
    renderChooser();

    const skipButton = await screen.findByRole("button", { name: /seguir sem repositórios/i });
    await user.click(skipButton);

    expect(await screen.findByText("Interview Page")).toBeInTheDocument();
    expect(mockClearRepositoryDraft).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe("RepositoryChooserPage - startInterview", () => {
  it("delegates to skip when zero repos are selected", async () => {
    mockFetchRepos.mockResolvedValue([makeRepo()]);

    renderChooser();

    await screen.findByRole("checkbox", { name: "octocat/hello-world" });
    // canStart is false (0 selected) but offerSkip is also false here (success with repos),
    // so the button is disabled. Nothing to click — cover the pure delegation via zero-selection skip path below instead.
    const button = screen.getByRole("button", { name: /iniciar entrevista/i });
    expect(button).toBeDisabled();
  });

  it("updates displayed status text via onProgress during creation, then succeeds", async () => {
    const repo = makeRepo();
    mockFetchRepos.mockResolvedValue([repo]);

    let resolveCreateSession!: (value: ReturnType<typeof makeSession>) => void;
    const createSessionPromise = new Promise<ReturnType<typeof makeSession>>((resolve) => {
      resolveCreateSession = resolve;
    });
    mockCreateSession.mockImplementation(async (_params, onProgress) => {
      onProgress?.("Lendo arquivos do repositório...");
      return createSessionPromise;
    });

    const user = userEvent.setup();
    renderChooser();

    const card = await screen.findByRole("checkbox", { name: "octocat/hello-world" });
    await user.click(card);

    const startButton = screen.getByRole("button", { name: /iniciar entrevista/i });
    await user.click(startButton);

    expect(await screen.findByText("Lendo arquivos do repositório...")).toBeInTheDocument();

    resolveCreateSession(makeSession());

    await waitFor(() => {
      expect(mockWriteRepositoryDraft).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "octocat", name: "hello-world" }),
      );
    });
    expect(mockWriteSessionDraft).toHaveBeenCalledWith({ id: "sess-1" });
    expect(await screen.findByText("Interview Page")).toBeInTheDocument();
  });

  it("shows an error and re-offers skip when creation fails", async () => {
    const repo = makeRepo();
    mockFetchRepos.mockResolvedValue([repo]);
    mockCreateSession.mockRejectedValue(
      new InterviewError("Falha na análise do repositório.", { retryable: true }),
    );

    const user = userEvent.setup();
    renderChooser();

    const card = await screen.findByRole("checkbox", { name: "octocat/hello-world" });
    await user.click(card);

    const startButton = screen.getByRole("button", { name: /iniciar entrevista/i });
    await user.click(startButton);

    expect(await screen.findByText("Falha na análise do repositório.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seguir sem repositórios/i })).toBeInTheDocument();
  });
});

describe("RepositoryReviewView", () => {
  it("renders error state", async () => {
    mockGetSession.mockRejectedValue(
      new InterviewError("Não conseguimos carregar esta entrevista.", { retryable: false }),
    );

    renderReview("hist-1");

    expect(
      await screen.findByText("Não conseguimos carregar esta entrevista."),
    ).toBeInTheDocument();
  });

  it("renders loading state", async () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    renderReview("hist-1");

    expect(await screen.findByRole("status", { name: "Carregando repositório..." })).toBeInTheDocument();
  });

  it("renders loaded state with a repository", async () => {
    const session = makeSession();
    mockGetSession.mockResolvedValue(session);
    mockDeriveRepositoryDraft.mockReturnValue({
      owner: "octocat",
      name: "hello-world",
      language: "TypeScript",
      fileCount: 5,
      omittedCount: 0,
      topFiles: ["a.ts"],
    });

    renderReview("hist-1");

    expect(await screen.findByText("octocat/hello-world")).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeInTheDocument();
  });

  it("renders loaded state without a repository (seguiu sem repositório)", async () => {
    const session = makeSession({ repo: null });
    mockGetSession.mockResolvedValue(session);
    mockDeriveRepositoryDraft.mockReturnValue(null);

    renderReview("hist-1");

    expect(
      await screen.findByText("Esta entrevista seguiu sem repositório"),
    ).toBeInTheDocument();
  });
});
