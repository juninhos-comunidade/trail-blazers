import { afterEach, describe, expect, it, vi } from "vitest";

import { TOKEN_STORAGE_KEY } from "../auth/auth-context";
import { jsonResponse, mockFetchOnce, mockFetchRejectOnce } from "../test/fetch-mock";
import {
  createSession,
  deleteSession,
  generateReport,
  getReport,
  getSession,
  InterviewError,
  listSessions,
  submitAnswer,
  type InterviewSession,
} from "./interview-api";

const sampleSession: InterviewSession = {
  id: "s1",
  status: "in_progress",
  vacancyId: "v1",
  repo: null,
  questions: [],
};

describe("mapErrorResponse via listSessions/getSession/submitAnswer/generateReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("code vaga_ainda_analisando -> retryable true, specific hint", async () => {
    mockFetchOnce(jsonResponse({ code: "vaga_ainda_analisando" }, { status: 409, ok: false }));

    await expect(listSessions()).rejects.toMatchObject({
      name: "InterviewError",
      hint: "Aguarde a análise da vaga terminar e tente de novo.",
      retryable: true,
      code: "vaga_ainda_analisando",
    });
  });

  it("code vaga_sem_perfil -> retryable false", async () => {
    mockFetchOnce(jsonResponse({ code: "vaga_sem_perfil" }, { status: 422, ok: false }));

    await expect(listSessions()).rejects.toMatchObject({
      retryable: false,
      code: "vaga_sem_perfil",
    });
  });

  it("code repo_vazio -> retryable false", async () => {
    mockFetchOnce(jsonResponse({ code: "repo_vazio" }, { status: 422, ok: false }));

    await expect(listSessions()).rejects.toMatchObject({
      retryable: false,
      code: "repo_vazio",
      hint: "Escolha outro repositório para a entrevista.",
    });
  });

  it.each([
    [true, true],
    [false, false],
    [undefined, true],
  ] as const)("code ia_indisponivel* with body.retryable=%s -> retryable %s", async (bodyRetryable, expected) => {
    mockFetchOnce(
      jsonResponse({ code: "ia_indisponivel_timeout", retryable: bodyRetryable }, { status: 502, ok: false }),
    );

    await expect(listSessions()).rejects.toMatchObject({
      retryable: expected,
      code: "ia_indisponivel_timeout",
      hint: "Costuma ser passageiro — tente de novo em instantes.",
    });
  });

  it("code respostas_pendentes -> retryable false, no hint", async () => {
    mockFetchOnce(jsonResponse({ code: "respostas_pendentes" }, { status: 400, ok: false }));

    let caught: InterviewError | undefined;
    try {
      await listSessions();
    } catch (err) {
      caught = err as InterviewError;
    }

    expect(caught?.retryable).toBe(false);
    expect(caught?.code).toBe("respostas_pendentes");
    expect(caught?.hint).toBeUndefined();
  });

  it.each([401, 403])("status %d without a recognized code -> invalid session, not retryable", async (status) => {
    mockFetchOnce(jsonResponse({}, { status, ok: false }));

    await expect(listSessions()).rejects.toMatchObject({
      detail: "Sua sessão não é mais válida.",
      retryable: false,
    });
  });

  it("status 401 WITH a recognized code -> code branch takes precedence over status branch", async () => {
    mockFetchOnce(jsonResponse({ code: "repo_vazio" }, { status: 401, ok: false }));

    await expect(listSessions()).rejects.toMatchObject({
      detail: "Repositório vazio.",
      code: "repo_vazio",
      retryable: false,
    });
  });

  it("status 404 -> session-not-found, not retryable", async () => {
    mockFetchOnce(jsonResponse({}, { status: 404, ok: false }));

    await expect(getSession("s1")).rejects.toMatchObject({
      detail: "Não encontramos esta sessão de entrevista.",
      retryable: false,
    });
  });

  it("status >= 500 without code -> generic server message, retryable defaults to true", async () => {
    mockFetchOnce(jsonResponse({}, { status: 500, ok: false }));

    await expect(getSession("s1")).rejects.toMatchObject({
      detail: "O servidor não conseguiu responder agora.",
      hint: "Costuma ser temporário.",
      retryable: true,
    });
  });

  it("unknown status without code -> generic fallback message with the status embedded", async () => {
    mockFetchOnce(jsonResponse({}, { status: 418, ok: false }));

    await expect(getSession("s1")).rejects.toMatchObject({
      detail: "A requisição falhou com o código 418.",
    });
  });

  it("firstMessage: message as array uses [0]", async () => {
    mockFetchOnce(jsonResponse({ message: ["primeira", "segunda"] }, { status: 418, ok: false }));

    await expect(getSession("s1")).rejects.toMatchObject({ detail: "primeira" });
  });

  it("firstMessage: message as string used directly", async () => {
    mockFetchOnce(jsonResponse({ message: "mensagem única" }, { status: 418, ok: false }));

    await expect(getSession("s1")).rejects.toMatchObject({ detail: "mensagem única" });
  });

  it("firstMessage: absent message falls back to the generic status message", async () => {
    mockFetchOnce(jsonResponse({}, { status: 418, ok: false }));

    await expect(getSession("s1")).rejects.toMatchObject({
      detail: "A requisição falhou com o código 418.",
    });
  });

  it("submitAnswer / generateReport also route through mapErrorResponse", async () => {
    mockFetchOnce(jsonResponse({ code: "repo_vazio" }, { status: 422, ok: false }));
    await expect(submitAnswer("s1", "q1", "resposta")).rejects.toMatchObject({ code: "repo_vazio" });

    mockFetchOnce(jsonResponse({ code: "repo_vazio" }, { status: 422, ok: false }));
    await expect(generateReport("s1")).rejects.toMatchObject({ code: "repo_vazio" });
  });
});

describe("InterviewError defaults", () => {
  it("retryable defaults to true when omitted", () => {
    const err = new InterviewError("oops");
    expect(err.retryable).toBe(true);
  });

  it("respects explicit retryable: false", () => {
    const err = new InterviewError("oops", { retryable: false });
    expect(err.retryable).toBe(false);
  });
});

describe("request() helper (via listSessions)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("network error -> InterviewError with the offline message", async () => {
    mockFetchRejectOnce();

    await expect(listSessions()).rejects.toMatchObject({
      detail: "Não conseguimos falar com o servidor do InterviewTrail.",
      hint: "Verifique sua conexão e tente de novo.",
    });
  });

  it("includes Authorization header when a token is present", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "tok-xyz");
    const fetchMock = mockFetchOnce(jsonResponse([], { status: 200 }));

    await listSessions();

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-xyz" });
  });

  it("omits Authorization header when there is no token", async () => {
    const fetchMock = mockFetchOnce(jsonResponse([], { status: 200 }));

    await listSessions();

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("adds Content-Type only when there is a body", async () => {
    const fetchMockWithBody = mockFetchOnce(
      jsonResponse({ answer: { id: "a1", questionId: "q1", content: "x" }, allAnswered: false }, { status: 200 }),
    );
    await submitAnswer("s1", "q1", "resposta");
    const [, initWithBody] = fetchMockWithBody.mock.calls[0];
    expect((initWithBody as RequestInit).headers).toMatchObject({ "Content-Type": "application/json" });

    const fetchMockNoBody = mockFetchOnce(jsonResponse([], { status: 200 }));
    await listSessions();
    const [, initNoBody] = fetchMockNoBody.mock.calls[0];
    expect((initNoBody as RequestInit).headers).not.toHaveProperty("Content-Type");
  });

  it("ok response with malformed JSON -> generic unreadable-response error", async () => {
    const response = jsonResponse(null, { status: 200 });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);

    await expect(listSessions()).rejects.toMatchObject({
      detail: "O servidor respondeu num formato que não conseguimos ler.",
    });
  });

  it("non-ok response with unparseable body still maps correctly with body: null", async () => {
    const response = jsonResponse(null, { status: 500, ok: false });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);

    await expect(listSessions()).rejects.toMatchObject({
      detail: "O servidor não conseguiu responder agora.",
    });
  });
});

// --- createSession: non-streaming JSON path -------------------------------

describe("createSession — plain JSON path (no ndjson body/content-type)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses the response directly as an InterviewSession when not streaming", async () => {
    const response = {
      ok: true,
      status: 200,
      body: null,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(sampleSession),
    } as unknown as Response;
    mockFetchOnce(response);

    const result = await createSession({ vacancyId: "v1", owner: "acme", repo: "repo" });
    expect(result).toEqual(sampleSession);
  });

  it("maps the error when the non-streaming response is not ok", async () => {
    const response = {
      ok: false,
      status: 422,
      body: null,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ code: "repo_vazio" }),
    } as unknown as Response;
    mockFetchOnce(response);

    await expect(createSession({ vacancyId: "v1", owner: "acme", repo: "repo" })).rejects.toMatchObject({
      code: "repo_vazio",
    });
  });

  it("network error while creating the session", async () => {
    mockFetchRejectOnce();

    await expect(createSession({ vacancyId: "v1", owner: "acme", repo: "repo" })).rejects.toMatchObject({
      detail: "Não conseguimos falar com o servidor do InterviewTrail.",
    });
  });
});

// --- createSession: NDJSON streaming path ----------------------------------

/** Builds a fake `Response` whose `.body.getReader().read()` yields the given chunks in order. */
function streamingResponse(chunks: string[], opts: { ok?: boolean; status?: number } = {}): Response {
  const encoder = new TextEncoder();
  let index = 0;

  const read = vi.fn(async () => {
    if (index < chunks.length) {
      const value = encoder.encode(chunks[index]);
      index += 1;
      return { done: false, value };
    }
    return { done: true, value: undefined };
  });

  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: new Headers({ "content-type": "application/x-ndjson" }),
    body: { getReader: () => ({ read }) },
    json: () => Promise.reject(new Error("should not be called on the streaming path")),
  } as unknown as Response;
}

function ndjson(events: unknown[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

describe("createSession — NDJSON streaming path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores empty lines", async () => {
    mockFetchOnce(
      streamingResponse(["\n\n", ndjson([{ type: "result", session: sampleSession }])]),
    );

    const result = await createSession({ vacancyId: "v1", owner: "acme", repo: "repo" });
    expect(result).toEqual(sampleSession);
  });

  it("calls onProgress for each progress event, in order", async () => {
    const onProgress = vi.fn();
    mockFetchOnce(
      streamingResponse([
        ndjson([
          { type: "progress", message: "Lendo repositório..." },
          { type: "progress", message: "Gerando perguntas..." },
          { type: "result", session: sampleSession },
        ]),
      ]),
    );

    await createSession({ vacancyId: "v1", owner: "acme", repo: "repo" }, onProgress);

    expect(onProgress).toHaveBeenNthCalledWith(1, "Lendo repositório...");
    expect(onProgress).toHaveBeenNthCalledWith(2, "Gerando perguntas...");
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it("does not throw when onProgress is omitted", async () => {
    mockFetchOnce(
      streamingResponse([
        ndjson([{ type: "progress", message: "..." }, { type: "result", session: sampleSession }]),
      ]),
    );

    await expect(createSession({ vacancyId: "v1", owner: "acme", repo: "repo" })).resolves.toEqual(sampleSession);
  });

  it("reconstructs a progress event split across two chunks", async () => {
    const onProgress = vi.fn();
    const full = ndjson([{ type: "progress", message: "meio da mensagem" }, { type: "result", session: sampleSession }]);
    const splitAt = Math.floor(full.length / 2);

    mockFetchOnce(streamingResponse([full.slice(0, splitAt), full.slice(splitAt)]));

    await createSession({ vacancyId: "v1", owner: "acme", repo: "repo" }, onProgress);

    expect(onProgress).toHaveBeenCalledWith("meio da mensagem");
  });

  it("processes multiple NDJSON lines delivered in a single read()", async () => {
    const onProgress = vi.fn();
    mockFetchOnce(
      streamingResponse([
        ndjson([
          { type: "progress", message: "um" },
          { type: "progress", message: "dois" },
          { type: "progress", message: "três" },
          { type: "result", session: sampleSession },
        ]),
      ]),
    );

    await createSession({ vacancyId: "v1", owner: "acme", repo: "repo" }, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it("an error event does not throw immediately — keeps draining the stream — then throws mapErrorResponse at the end", async () => {
    const onProgress = vi.fn();
    mockFetchOnce(
      streamingResponse([
        ndjson([{ type: "progress", message: "antes do erro" }]),
        ndjson([
          { type: "error", status: 422, code: "repo_vazio", message: "Repositório vazio." },
          { type: "progress", message: "depois do erro, ainda consumido" },
        ]),
      ]),
    );

    await expect(createSession({ vacancyId: "v1", owner: "acme", repo: "repo" }, onProgress)).rejects.toMatchObject({
      code: "repo_vazio",
      detail: "Repositório vazio.",
      retryable: false,
    });

    // progress events on both sides of the error line were still delivered
    expect(onProgress).toHaveBeenCalledWith("antes do erro");
    expect(onProgress).toHaveBeenCalledWith("depois do erro, ainda consumido");
  });

  it("a result event with the stream ending cleanly resolves with the session", async () => {
    mockFetchOnce(streamingResponse([ndjson([{ type: "result", session: sampleSession }])]));

    await expect(createSession({ vacancyId: "v1", owner: "acme", repo: "repo" })).resolves.toEqual(sampleSession);
  });

  it("stream ends without ever receiving a result or error event -> throws the connection-closed error", async () => {
    mockFetchOnce(streamingResponse([ndjson([{ type: "progress", message: "só isso" }])]));

    await expect(createSession({ vacancyId: "v1", owner: "acme", repo: "repo" })).rejects.toMatchObject({
      detail: "O servidor encerrou a conexão antes de terminar.",
      hint: "Tente novamente.",
    });
  });
});

// --- deleteSession -----------------------------------------------------------

describe("deleteSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("succeeds without parsing the body", async () => {
    const response = jsonResponse(null, { status: 204 });
    response.json = () => Promise.reject(new Error("should not be called"));
    mockFetchOnce(response);

    await expect(deleteSession("s1")).resolves.toBeUndefined();
  });

  it("network error mapped like other requests", async () => {
    mockFetchRejectOnce();
    await expect(deleteSession("s1")).rejects.toMatchObject({
      detail: "Não conseguimos falar com o servidor do InterviewTrail.",
    });
  });

  it("HTTP error mapped via mapErrorResponse", async () => {
    mockFetchOnce(jsonResponse({}, { status: 404, ok: false }));
    await expect(deleteSession("s1")).rejects.toMatchObject({
      detail: "Não encontramos esta sessão de entrevista.",
    });
  });
});

// --- getReport -----------------------------------------------------------

describe("getReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("status 404 returns null (not an error)", async () => {
    mockFetchOnce(jsonResponse(null, { status: 404, ok: false }));
    await expect(getReport("s1")).resolves.toBeNull();
  });

  it("other non-ok status maps via mapErrorResponse", async () => {
    mockFetchOnce(jsonResponse({}, { status: 500, ok: false }));
    await expect(getReport("s1")).rejects.toMatchObject({
      detail: "O servidor não conseguiu responder agora.",
    });
  });

  it("ok with malformed JSON -> parse error", async () => {
    const response = jsonResponse(null, { status: 200 });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);

    await expect(getReport("s1")).rejects.toMatchObject({
      detail: "O servidor respondeu num formato que não conseguimos ler.",
    });
  });
});
