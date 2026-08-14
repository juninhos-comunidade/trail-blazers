import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { Routes, Route } from "react-router-dom";
import userEvent from "@testing-library/user-event";

import { InterviewPage } from "./InterviewPage";
import { paths, reportPath } from "@routes/paths";
import { readVacancyDraft, readSessionDraft } from "@lib/interview-draft";
import { getSession, submitAnswer, InterviewError, type InterviewQuestion, type InterviewSession } from "@lib/interview-api";
import { createRecognizer, isSpeechRecognitionSupported, speak, stopSpeaking } from "@lib/speech";
import { renderWithProviders, screen, waitFor } from "../test/render";

vi.mock("@lib/interview-draft", () => ({
  readVacancyDraft: vi.fn(),
  readSessionDraft: vi.fn(),
}));

vi.mock("@lib/interview-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lib/interview-api")>();
  return {
    ...actual,
    getSession: vi.fn(),
    submitAnswer: vi.fn(),
  };
});

vi.mock("@lib/speech", () => ({
  createRecognizer: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isSpeechRecognitionSupported: vi.fn(() => false),
  speak: vi.fn(() => Promise.resolve()),
  stopSpeaking: vi.fn(),
}));

function makeQuestion(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return {
    id: "q1",
    orderIndex: 0,
    type: "logic",
    content: "Pergunta padrão?",
    metadata: null,
    answer: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: "sess-1",
    status: "in_progress",
    vacancyId: "vac-1",
    repo: null,
    questions: [],
    ...overrides,
  };
}

function renderPage(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path={`${paths.interview}/:sessionId?`} element={<InterviewPage />} />
      <Route path={paths.newInterview} element={<div>NEW_INTERVIEW_PAGE</div>} />
      <Route path={paths.dashboard} element={<div>DASHBOARD_PAGE</div>} />
      <Route path={paths.repoChooser} element={<div>REPO_CHOOSER_PAGE</div>} />
      <Route path={`${paths.report}/:sessionId`} element={<div>REPORT_PAGE</div>} />
    </Routes>,
    { route },
  );
}

async function waitForSpinnerGone() {
  await waitFor(() => {
    expect(screen.queryByText("Carregando entrevista...")).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  (readVacancyDraft as Mock).mockReturnValue({ id: "vac-1", description: "desc" });
  (readSessionDraft as Mock).mockReturnValue({ id: "sess-1" });
  (getSession as Mock).mockReturnValue(new Promise(() => {})); // never resolves by default
  (submitAnswer as Mock).mockResolvedValue({ answer: { id: "a1", questionId: "q1", content: "x" }, allAnswered: false });
  (isSpeechRecognitionSupported as Mock).mockReturnValue(false);
  (createRecognizer as Mock).mockImplementation(() => ({ start: vi.fn(), stop: vi.fn() }));
  (speak as Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("InterviewPage — modo / guarda de rota", () => {
  it("modo histórico usa {id: historicalId} e ignora sessionStorage", async () => {
    (getSession as Mock).mockResolvedValue(makeSession({ id: "hist-1", questions: [] }));

    renderPage(`${paths.interview}/hist-1`);

    await waitFor(() => expect(getSession).toHaveBeenCalledWith("hist-1"));
    expect(readSessionDraft).not.toHaveBeenCalled();
    expect(readVacancyDraft).not.toHaveBeenCalled();
  });

  it("modo fresh sem historicalId lê vacancy/sessionDraft do storage", async () => {
    (getSession as Mock).mockResolvedValue(makeSession({ id: "sess-1", questions: [] }));

    renderPage(paths.interview);

    await waitFor(() => expect(getSession).toHaveBeenCalledWith("sess-1"));
    expect(readVacancyDraft).toHaveBeenCalled();
    expect(readSessionDraft).toHaveBeenCalled();
  });

  it.each([
    ["sem sessão", { id: "vac-1", description: "desc" }, null],
    ["sem nenhum dos dois", null, null],
  ])("fresh %s no storage → redireciona para newInterview", async (_label, vacancy, sessionDraft) => {
    (readVacancyDraft as Mock).mockReturnValue(vacancy);
    (readSessionDraft as Mock).mockReturnValue(sessionDraft);

    renderPage(paths.interview);

    expect(await screen.findByText("NEW_INTERVIEW_PAGE")).toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("fresh sem vaga (mas com sessionDraft válido) → redireciona, mas o fetch da sessão ainda dispara (hooks rodam antes do guard-return)", async () => {
    (readVacancyDraft as Mock).mockReturnValue(null);
    (readSessionDraft as Mock).mockReturnValue({ id: "sess-1" });
    (getSession as Mock).mockResolvedValue(makeSession({ id: "sess-1", questions: [] }));

    renderPage(paths.interview);

    expect(await screen.findByText("NEW_INTERVIEW_PAGE")).toBeInTheDocument();
    // NOTE: the load effect isn't conditioned on the guard, so it still fires
    // even though we redirect away — a harmless but wasted network call.
    await waitFor(() => expect(getSession).toHaveBeenCalledWith("sess-1"));
  });

  it("histórico bypassa a guarda mesmo sem draft local", async () => {
    (readVacancyDraft as Mock).mockReturnValue(null);
    (readSessionDraft as Mock).mockReturnValue(null);
    (getSession as Mock).mockResolvedValue(makeSession({ id: "hist-1", questions: [] }));

    renderPage(`${paths.interview}/hist-1`);

    expect(screen.queryByText("NEW_INTERVIEW_PAGE")).not.toBeInTheDocument();
    await waitFor(() => expect(getSession).toHaveBeenCalledWith("hist-1"));
  });
});

describe("InterviewPage — derivação de currentIndex/finished/currentQuestion", () => {
  it("encontra a primeira pergunta sem resposta (currentIndex no meio)", async () => {
    const questions = [
      makeQuestion({ id: "q1", content: "Primeira?", answer: { content: "resp1", createdAt: "2024-01-01" } }),
      makeQuestion({ id: "q2", content: "Segunda atual?", answer: null }),
      makeQuestion({ id: "q3", content: "Terceira futura?", answer: null }),
    ];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(await screen.findByText("Primeira?")).toBeInTheDocument();
    expect(screen.getByText("resp1")).toBeInTheDocument();
    expect(screen.getByText("Segunda atual?")).toBeInTheDocument();
    expect(screen.queryByText("Terceira futura?")).not.toBeInTheDocument();
  });

  it("todas respondidas → finished true, mensagem de fechamento aparece", async () => {
    const questions = [
      makeQuestion({ id: "q1", content: "Pergunta1?", answer: { content: "r1", createdAt: "2024-01-01" } }),
      makeQuestion({ id: "q2", content: "Pergunta2?", answer: { content: "r2", createdAt: "2024-01-01" } }),
    ];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(await screen.findByText(/entrevista concluída/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver meu relatório/i })).toBeInTheDocument();
  });

  it("nenhuma respondida → currentIndex 0", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Única pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(await screen.findByText("Única pergunta?")).toBeInTheDocument();
  });

  it("lista vazia de perguntas NÃO é finished", async () => {
    (getSession as Mock).mockResolvedValue(makeSession({ questions: [] }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(screen.queryByText(/entrevista concluída/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ver meu relatório/i })).not.toBeInTheDocument();
    // input row is still shown (not finished)
    expect(screen.getByLabelText("Sua resposta")).toBeInTheDocument();
  });
});

describe("InterviewPage — TTS automático", () => {
  it("fala a pergunta atual apenas uma vez por pergunta, mesmo com re-render não relacionado", async () => {
    localStorage.setItem("interviewtrail.tts-enabled", "1");
    const questions = [makeQuestion({ id: "q1", content: "Fale isso?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Fale isso?");

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(speak).toHaveBeenCalledWith("Fale isso?");

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta");
    await user.type(textarea, "a");

    // Unrelated re-render (draft change) must not re-trigger speak for same question.
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("toggleTts desligado chama stopSpeaking imediatamente", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: /ativar leitura das perguntas em voz alta/i });
    await user.click(toggle); // turn on
    expect(screen.getByRole("button", { name: /desativar leitura das perguntas em voz alta/i })).toBeInTheDocument();

    // Reset call count right before the action under test, so any effect
    // cleanup left over from a previous test's unmount (React flushes
    // passive-effect cleanups asynchronously) can't be mistaken for this one.
    (stopSpeaking as Mock).mockClear();

    const toggleOff = screen.getByRole("button", { name: /desativar leitura das perguntas em voz alta/i });
    await user.click(toggleOff); // turn off
    expect(stopSpeaking).toHaveBeenCalled();
  });

  it("repeatQuestion sempre fala de novo, ignorando o dedup do auto-speak", async () => {
    localStorage.setItem("interviewtrail.tts-enabled", "1");
    const questions = [makeQuestion({ id: "q1", content: "Repita isso?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Repita isso?");
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    const repeatButton = screen.getByRole("button", { name: /repetir a pergunta em voz alta/i });
    await user.click(repeatButton);

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
    expect(speak).toHaveBeenNthCalledWith(2, "Repita isso?");
  });

  it("clicar 'repetir' de novo antes da fala anterior terminar não dispara uma segunda chamada a speak", async () => {
    localStorage.setItem("interviewtrail.tts-enabled", "1");
    const questions = [makeQuestion({ id: "q1", content: "Repita isso?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    let resolveAutoSpeak: () => void = () => {};
    (speak as Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveAutoSpeak = resolve)),
    );

    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Repita isso?");
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));

    const repeatButton = screen.getByRole("button", { name: /repetir a pergunta em voz alta/i });
    // Enquanto a fala automática da pergunta ainda está em andamento, o botão
    // já deve estar desabilitado — clicar não deve disparar uma 2ª chamada.
    expect(repeatButton).toBeDisabled();

    resolveAutoSpeak();
    await waitFor(() => expect(repeatButton).toBeEnabled());

    let resolveFirstRepeat: () => void = () => {};
    (speak as Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveFirstRepeat = resolve)),
    );

    const user = userEvent.setup();
    await user.click(repeatButton);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(repeatButton).toBeDisabled();

    // Segundo clique enquanto a primeira chamada de "repetir" ainda está em
    // voo: nenhuma nova chamada a speak deve acontecer — é exatamente o
    // clique duplo que causava dois áudios tocando ao mesmo tempo.
    await user.click(repeatButton);
    expect(speak).toHaveBeenCalledTimes(2);

    resolveFirstRepeat();
    await waitFor(() => expect(repeatButton).toBeEnabled());

    // Só depois de terminar é que um novo clique dispara outra chamada.
    await user.click(repeatButton);
    expect(speak).toHaveBeenCalledTimes(3);
  });

  it("desmontagem chama stopSpeaking", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    const { unmount } = renderPage(paths.interview);
    await waitForSpinnerGone();

    unmount();
    expect(stopSpeaking).toHaveBeenCalled();
  });
});

describe("InterviewPage — gravação por voz", () => {
  let handlers: { onResult: (t: string, f: boolean) => void; onEnd: () => void; onError: (r: string) => void };
  let controls: { start: Mock; stop: Mock };

  beforeEach(() => {
    (isSpeechRecognitionSupported as Mock).mockReturnValue(true);
    controls = { start: vi.fn(), stop: vi.fn() };
    (createRecognizer as Mock).mockImplementation((h) => {
      handlers = h;
      return controls;
    });
  });

  async function setupRecording() {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Pergunta?");
    const user = userEvent.setup();
    return user;
  }

  it("iniciar gravação cria recognizer e marca recording true", async () => {
    const user = await setupRecording();
    const micButton = screen.getByRole("button", { name: /responder por voz/i });
    await user.click(micButton);

    expect(createRecognizer).toHaveBeenCalled();
    expect(controls.start).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /parar gravação/i })).toBeInTheDocument();
  });

  it("resultado interim não atualiza o draft", async () => {
    const user = await setupRecording();
    await user.click(screen.getByRole("button", { name: /responder por voz/i }));

    handlers.onResult("texto parcial", false);

    const textarea = screen.getByLabelText("Sua resposta") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("resultado final anexa ao texto base (sem separador quando draft vazio)", async () => {
    const user = await setupRecording();
    await user.click(screen.getByRole("button", { name: /responder por voz/i }));

    handlers.onResult("olá mundo", true);

    const textarea = screen.getByLabelText("Sua resposta") as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("olá mundo"));
  });

  it("resultado final com draft pré-existente adiciona separador de espaço", async () => {
    const user = await setupRecording();
    const textarea = screen.getByLabelText("Sua resposta") as HTMLTextAreaElement;
    await user.type(textarea, "abc");
    await user.click(screen.getByRole("button", { name: /responder por voz/i }));

    handlers.onResult("def", true);

    await waitFor(() => expect(textarea.value).toBe("abc def"));
  });

  it("múltiplos resultados finais na mesma gravação acumulam", async () => {
    const user = await setupRecording();
    await user.click(screen.getByRole("button", { name: /responder por voz/i }));

    handlers.onResult("hello", true);
    await waitFor(() => expect((screen.getByLabelText("Sua resposta") as HTMLTextAreaElement).value).toBe("hello"));

    handlers.onResult("world", true);
    await waitFor(() =>
      expect((screen.getByLabelText("Sua resposta") as HTMLTextAreaElement).value).toBe("hello world"),
    );
  });

  it.each([
    ["not-allowed", "Permissão de microfone negada."],
    ["permission-denied", "Permissão de microfone negada."],
    ["no-speech", "Não conseguimos reconhecer sua fala. Tente novamente."],
    ["network", "Não conseguimos reconhecer sua fala. Tente novamente."],
  ])("onError(%s) → mensagem: %s", async (reason, expected) => {
    const user = await setupRecording();
    await user.click(screen.getByRole("button", { name: /responder por voz/i }));

    handlers.onError(reason);

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /responder por voz/i })).toBeInTheDocument();
  });

  it("recording só volta a false após onEnd disparar, não direto no clique de parar", async () => {
    const user = await setupRecording();
    await user.click(screen.getByRole("button", { name: /responder por voz/i }));
    expect(screen.getByRole("button", { name: /parar gravação/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /parar gravação/i }));
    expect(controls.stop).toHaveBeenCalled();
    // still "recording" (still shows "parar gravação") until onEnd fires
    expect(screen.getByRole("button", { name: /parar gravação/i })).toBeInTheDocument();

    handlers.onEnd();
    await waitFor(() => expect(screen.getByRole("button", { name: /responder por voz/i })).toBeInTheDocument());
  });
});

describe("InterviewPage — send()", () => {
  it("Enter sem Shift envia a resposta", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Pergunta?");

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta");
    await user.type(textarea, "minha resposta{Enter}");

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledWith("sess-1", "q1", "minha resposta"));
  });

  it("Shift+Enter insere quebra de linha e NÃO envia", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Pergunta?");

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta") as HTMLTextAreaElement;
    await user.type(textarea, "linha1{Shift>}{Enter}{/Shift}linha2");

    expect(submitAnswer).not.toHaveBeenCalled();
    expect(textarea.value).toBe("linha1\nlinha2");
  });

  it("envio com resposta vazia/em branco é bloqueado (botão desabilitado)", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Pergunta?");

    const sendButton = screen.getByRole("button", { name: /enviar resposta/i });
    expect(sendButton).toBeDisabled();

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta");
    await user.type(textarea, "   ");
    expect(sendButton).toBeDisabled();
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it("sucesso limpa o draft e atualiza a pergunta certa localmente", async () => {
    const questions = [
      makeQuestion({ id: "q1", content: "Primeira pergunta?", answer: null }),
      makeQuestion({ id: "q2", content: "Segunda pergunta?", answer: null }),
    ];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    (submitAnswer as Mock).mockResolvedValue({
      answer: { id: "a1", questionId: "q1", content: "resposta boa" },
      allAnswered: false,
    });
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Primeira pergunta?");
    expect(screen.queryByText("Segunda pergunta?")).not.toBeInTheDocument();

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta") as HTMLTextAreaElement;
    await user.type(textarea, "resposta boa{Enter}");

    // q1 now shows its answer, and q2 (the new current question) appears.
    await waitFor(() => expect(screen.getByText("resposta boa")).toBeInTheDocument());
    expect(await screen.findByText("Segunda pergunta?")).toBeInTheDocument();
    await waitFor(() => expect(textarea.value).toBe(""));
  });

  it("sucesso com a última pergunta finaliza a entrevista", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Única pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    (submitAnswer as Mock).mockResolvedValue({
      answer: { id: "a1", questionId: "q1", content: "resposta final" },
      allAnswered: true,
    });
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Única pergunta?");

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta");
    await user.type(textarea, "resposta final{Enter}");

    expect(await screen.findByText(/entrevista concluída/i)).toBeInTheDocument();
    expect(screen.getByText("resposta final")).toBeInTheDocument();
  });

  it("falha seta submitError e mantém draft preenchido", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    (submitAnswer as Mock).mockRejectedValue(new InterviewError("Não deu certo.", { hint: "tente de novo" }));
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Pergunta?");

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta") as HTMLTextAreaElement;
    await user.type(textarea, "minha resposta{Enter}");

    expect(await screen.findByText(/não deu certo\./i)).toBeInTheDocument();
    expect(textarea.value).toBe("minha resposta");
  });

  it("submitting sempre volta a false no finally, mesmo em erro", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Pergunta?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));
    (submitAnswer as Mock).mockRejectedValue(new InterviewError("Falhou."));
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Pergunta?");

    const user = userEvent.setup();
    const textarea = screen.getByLabelText("Sua resposta");
    await user.type(textarea, "minha resposta{Enter}");

    await screen.findByText(/falhou\./i);
    // textarea re-enabled (submitting false) after failure
    expect(textarea).not.toBeDisabled();
  });
});

describe("InterviewPage — carregamento de sessão com erro", () => {
  it("erro histórico → painel de erro com botão de volta para o dashboard", async () => {
    (getSession as Mock).mockRejectedValue(new InterviewError("Sessão sumiu.", { hint: "tente de novo" }));

    renderPage(`${paths.interview}/hist-1`);

    expect(await screen.findByText("Sessão sumiu.")).toBeInTheDocument();
    expect(screen.getByText("tente de novo")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /voltar/i });
    expect(backLink).toHaveAttribute("href", paths.dashboard);
  });

  it("erro fresh → painel de erro com botão de volta para o repo chooser", async () => {
    (getSession as Mock).mockRejectedValue(new InterviewError("Sessão sumiu."));

    renderPage(paths.interview);

    expect(await screen.findByText("Sessão sumiu.")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /voltar/i });
    expect(backLink).toHaveAttribute("href", paths.repoChooser);
  });

  it("erro não-InterviewError é envolvido em mensagem genérica", async () => {
    (getSession as Mock).mockRejectedValue(new Error("boom"));

    renderPage(paths.interview);

    expect(await screen.findByText("Não foi possível carregar a entrevista.")).toBeInTheDocument();
  });
});

describe("InterviewPage — estado finished", () => {
  it("oculta o campo de resposta e mostra links de relatório/dashboard", async () => {
    const questions = [makeQuestion({ id: "q1", content: "P?", answer: { content: "r", createdAt: "2024-01-01" } })];
    (getSession as Mock).mockResolvedValue(makeSession({ id: "sess-9", questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(screen.queryByLabelText("Sua resposta")).not.toBeInTheDocument();
    const reportLink = await screen.findByRole("link", { name: /ver meu relatório/i });
    expect(reportLink).toHaveAttribute("href", reportPath("sess-9"));
    const dashboardLink = screen.getByRole("link", { name: /voltar ao dashboard/i });
    expect(dashboardLink).toHaveAttribute("href", paths.dashboard);
  });
});

describe("InterviewPage — ChatMessage", () => {
  it("badge de tipo de pergunta só aparece quando há question associada (não na mensagem de fechamento)", async () => {
    const questions = [
      makeQuestion({ id: "q1", type: "scenario", content: "Cenário?", answer: { content: "r", createdAt: "2024-01-01" } }),
    ];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(await screen.findByText("Cenário")).toBeInTheDocument(); // badge label
    expect(await screen.findByText(/entrevista concluída/i)).toBeInTheDocument();
    // Only one badge should exist — none for the closing message.
    expect(screen.getAllByText("Cenário")).toHaveLength(1);
  });

  it("bloco de código só aparece quando metadata.codeExcerpt está presente", async () => {
    const withCode = makeQuestion({
      id: "q1",
      content: "Analise este código",
      metadata: { codeFile: "app.ts", codeExcerpt: "const x = 1;" },
      answer: null,
    });
    (getSession as Mock).mockResolvedValue(makeSession({ questions: [withCode] }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    expect(await screen.findByText("const x = 1;")).toBeInTheDocument();
    expect(screen.getByText("app.ts")).toBeInTheDocument();
  });

  it("sem metadata.codeExcerpt → nenhum bloco de código renderizado", async () => {
    const noCode = makeQuestion({ id: "q1", content: "Pergunta simples", metadata: null, answer: null });
    (getSession as Mock).mockResolvedValue(makeSession({ questions: [noCode] }));

    renderPage(paths.interview);
    await waitForSpinnerGone();

    await screen.findByText("Pergunta simples");
    expect(screen.queryByText("app.ts")).not.toBeInTheDocument();
  });

  it("botão 'repetir' só aparece na pergunta atual E com TTS ligado", async () => {
    const questions = [makeQuestion({ id: "q1", content: "Atual?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    // TTS off by default
    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Atual?");
    expect(screen.queryByRole("button", { name: /repetir a pergunta em voz alta/i })).not.toBeInTheDocument();
  });

  it("botão 'repetir' aparece quando é a pergunta atual e TTS está ligado", async () => {
    localStorage.setItem("interviewtrail.tts-enabled", "1");
    const questions = [makeQuestion({ id: "q1", content: "Atual com TTS?", answer: null })];
    (getSession as Mock).mockResolvedValue(makeSession({ questions }));

    renderPage(paths.interview);
    await waitForSpinnerGone();
    await screen.findByText("Atual com TTS?");

    expect(screen.getByRole("button", { name: /repetir a pergunta em voz alta/i })).toBeInTheDocument();
  });
});
