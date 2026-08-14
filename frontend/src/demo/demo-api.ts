import { API_URL } from "@lib/env";

import {
  buildDemoSession,
  demoPastSessions,
  demoProgressMessages,
  demoQuestions,
  demoReport,
  demoRepositories,
  demoSessionId,
  demoVacancyDescription,
  demoVacancyId,
  demoVacancyProfile,
} from "./demo-data";

/**
 * Backend falso do modo demonstração.
 *
 * Substitui `window.fetch` apenas para as chamadas que vão para a API do
 * InterviewTrail — qualquer outra URL segue para o fetch original. As latências
 * abaixo existem para o vídeo parecer real (spinner aparece), mas somam pouco
 * mais de 5 segundos no fluxo inteiro.
 */

const LATENCY = {
  short: 220,
  medium: 420,
  /** Tempo até a IA "terminar" de ler a vaga. */
  vacancyParse: 1_100,
  /** Intervalo entre as mensagens de progresso do preparo da entrevista. */
  progressStep: 450,
  /** Tempo até o relatório ficar pronto. */
  report: 1_100,
};

interface DemoState {
  vacancyCreatedAt: number | null;
  answers: Record<string, string>;
  reportReady: boolean;
}

const state: DemoState = {
  vacancyCreatedAt: null,
  answers: {},
  reportReady: false,
};

export function resetDemoState(): void {
  state.vacancyCreatedAt = null;
  state.answers = {};
  state.reportReady = false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function vacancyPayload() {
  const elapsed = state.vacancyCreatedAt ? Date.now() - state.vacancyCreatedAt : Infinity;
  const done = elapsed >= LATENCY.vacancyParse;

  return {
    id: demoVacancyId,
    userId: "demo-user-0001",
    rawDescription: demoVacancyDescription,
    parsedProfile: done ? demoVacancyProfile : null,
    parseStatus: done ? "done" : "pending",
    parseFailureReason: null,
    parsingCompleted: done,
    createdAt: new Date(state.vacancyCreatedAt ?? Date.now()).toISOString(),
  };
}

/** Stream NDJSON com as mensagens de progresso, igual ao backend real. */
function sessionStream(): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const message of demoProgressMessages) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "progress", message })}\n`),
        );
        await sleep(LATENCY.progressStep);
      }

      controller.enqueue(
        encoder.encode(
          `${JSON.stringify({ type: "result", session: buildDemoSession() })}\n`,
        ),
      );
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

async function handle(path: string, method: string): Promise<Response> {
  // --- Vagas ---------------------------------------------------------------
  if (path === "/vacancies" && method === "POST") {
    state.vacancyCreatedAt = Date.now();
    await sleep(LATENCY.medium);
    return json(vacancyPayload(), 201);
  }

  if (path.startsWith("/vacancies/")) {
    if (path.endsWith("/reparse")) {
      state.vacancyCreatedAt = Date.now();
      await sleep(LATENCY.short);
      return json(vacancyPayload(), 202);
    }

    if (path.endsWith("/profile")) {
      await sleep(LATENCY.short);
      return json(vacancyPayload());
    }

    await sleep(LATENCY.short);
    return json(vacancyPayload());
  }

  // --- Repositórios --------------------------------------------------------
  if (path === "/repositories") {
    await sleep(LATENCY.medium);
    return json(demoRepositories);
  }

  // --- Entrevista ----------------------------------------------------------
  if (path === "/interview/sessions" && method === "POST") {
    return sessionStream();
  }

  if (path === "/interview/sessions" && method === "GET") {
    await sleep(LATENCY.medium);
    return json(demoPastSessions);
  }

  if (path.startsWith("/interview/sessions/")) {
    const rest = path.slice("/interview/sessions/".length);
    const [id, action] = rest.split("/");

    if (action === "answers" && method === "POST") {
      await sleep(LATENCY.short);
      return json({ answer: { id: `a-${Date.now()}`, questionId: "", content: "" }, allAnswered: false });
    }

    if (action === "report") {
      if (method === "POST") {
        await sleep(LATENCY.report);
        state.reportReady = true;
        return json({ ...demoReport, sessionId: id, createdAt: new Date().toISOString() });
      }

      await sleep(LATENCY.short);

      if (!state.reportReady) {
        return json({ message: "Relatório ainda não gerado." }, 404);
      }

      return json({ ...demoReport, sessionId: id });
    }

    if (method === "DELETE") {
      await sleep(LATENCY.short);
      return json({});
    }

    await sleep(LATENCY.short);

    // Sessões antigas do dashboard entram aqui já concluídas.
    if (id !== demoSessionId) {
      const finished: Record<string, string> = {};
      demoQuestions.forEach(({ question, answer }) => {
        finished[question.id] = answer;
      });
      return json({ ...buildDemoSession(finished), id });
    }

    return json(buildDemoSession(state.answers));
  }

  // --- Voz -----------------------------------------------------------------
  if (path.startsWith("/tts")) {
    return json({ message: "Leitura em voz alta desligada na demonstração.", reason: "not_configured" }, 503);
  }

  return json({ message: `Rota não mockada na demonstração: ${method} ${path}` }, 404);
}

/** Registra a resposta enviada para que o GET da sessão devolva o estado novo. */
function recordAnswer(rawBody: BodyInit | null | undefined): void {
  if (typeof rawBody !== "string") return;

  try {
    const parsed = JSON.parse(rawBody) as { questionId?: string; content?: string };
    if (parsed.questionId && parsed.content) {
      state.answers[parsed.questionId] = parsed.content;
    }
  } catch {}
}

export function installDemoApi(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!url.startsWith(API_URL)) {
      return originalFetch(input, init);
    }

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = url.slice(API_URL.length).split("?")[0];

    if (path.endsWith("/answers") && method === "POST") {
      recordAnswer(init?.body);
    }

    return handle(path, method);
  };
}
