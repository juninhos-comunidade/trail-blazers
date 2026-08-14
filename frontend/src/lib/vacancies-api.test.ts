import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetchOnce, mockFetchRejectOnce } from "../test/fetch-mock";
import {
  createVacancy,
  describeAnalysis,
  getVacancy,
  reparseVacancy,
  updateVacancyProfile,
  waitForVacancyParsing,
  type Vacancy,
} from "./vacancies-api";

function rawVacancy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "v1",
    userId: "u1",
    rawDescription: "descrição da vaga",
    parsedProfile: null,
    parseFailureReason: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("createVacancy / ensureVacancy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws a non-retryable format error when id/rawDescription are missing or wrong-typed", async () => {
    mockFetchOnce(jsonResponse({ id: 123, rawDescription: "x" }, { status: 200 }));

    await expect(createVacancy("desc")).rejects.toMatchObject({
      name: "VacancyError",
      detail: "O servidor respondeu num formato que não conseguimos ler.",
      retryable: false,
    });
  });

  it("uses parseStatus as-is when present and valid", async () => {
    mockFetchOnce(jsonResponse(rawVacancy({ parseStatus: "failed", parsingCompleted: false }), { status: 200 }));

    const vacancy = await createVacancy("desc");
    expect(vacancy.parseStatus).toBe("failed");
    expect(vacancy.parsingCompleted).toBe(true); // recomputed from parseStatus, ignoring raw payload
  });

  it.each([
    [true, "done"],
    [false, "pending"],
    [undefined, "pending"],
  ] as const)(
    "derives parseStatus from parsingCompleted=%s when parseStatus is absent -> %s",
    async (parsingCompleted, expected) => {
      mockFetchOnce(jsonResponse(rawVacancy({ parsingCompleted }), { status: 200 }));

      const vacancy = await createVacancy("desc");
      expect(vacancy.parseStatus).toBe(expected);
    },
  );

  it("recomputes parsingCompleted as parseStatus !== 'pending' even if raw payload disagrees", async () => {
    mockFetchOnce(
      jsonResponse(rawVacancy({ parseStatus: "pending", parsingCompleted: true }), { status: 200 }),
    );

    const vacancy = await createVacancy("desc");
    expect(vacancy.parseStatus).toBe("pending");
    expect(vacancy.parsingCompleted).toBe(false);
  });

  it("defaults parseFailureReason to null when absent", async () => {
    mockFetchOnce(jsonResponse(rawVacancy({ parseStatus: "done" }), { status: 200 }));

    const vacancy = await createVacancy("desc");
    expect(vacancy.parseFailureReason).toBeNull();
  });

  it("throws network error VacancyError when fetch rejects", async () => {
    mockFetchRejectOnce();

    await expect(createVacancy("desc")).rejects.toMatchObject({
      name: "VacancyError",
      detail: "Não conseguimos falar com o servidor do InterviewTrail.",
      hint: "Verifique sua conexão e tente de novo.",
    });
  });

  it("throws a parse-error VacancyError when the success body is malformed", async () => {
    const response = jsonResponse(null, { status: 200 });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);

    await expect(createVacancy("desc")).rejects.toMatchObject({
      detail: "O servidor respondeu num formato que não conseguimos ler.",
    });
  });
});

describe("mapErrorResponse branch precedence and messages per context", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("400 on save context -> generic description-not-accepted message", async () => {
    mockFetchOnce(jsonResponse({}, { status: 400, ok: false }));

    await expect(createVacancy("desc")).rejects.toMatchObject({
      detail: "A descrição da vaga não foi aceita.",
      hint: "Ajuste e tente de novo.",
      retryable: false,
    });
  });

  it("400 on profile context -> changes-not-accepted message", async () => {
    mockFetchOnce(jsonResponse({}, { status: 400, ok: false }));

    await expect(updateVacancyProfile("v1", { technologies: [], seniorityLevel: "junior", keyCompetencies: [] })).rejects.toMatchObject({
      detail: "As alterações não foram aceitas.",
      retryable: false,
    });
  });

  it.each([401, 403])("status %d -> invalid session regardless of context", async (status) => {
    mockFetchOnce(jsonResponse({}, { status, ok: false }));

    await expect(getVacancy("v1")).rejects.toMatchObject({
      detail: "Sua sessão não é mais válida.",
      hint: "Saia e entre de novo para continuar.",
      retryable: false,
    });
  });

  it("404 with context != save -> vacancy-not-found message", async () => {
    mockFetchOnce(jsonResponse({}, { status: 404, ok: false }));

    await expect(getVacancy("v1")).rejects.toMatchObject({
      detail: "Não encontramos esta vaga no servidor.",
      retryable: false,
    });
  });

  it("404 with context save -> falls through to generic fallback (not treated as not-found)", async () => {
    mockFetchOnce(jsonResponse({}, { status: 404, ok: false }));

    await expect(createVacancy("desc")).rejects.toMatchObject({
      detail: "Não conseguimos salvar a vaga (código 404).",
    });
  });

  it("409 with editingProfile (profile context) -> cannot-be-adjusted message", async () => {
    mockFetchOnce(jsonResponse({}, { status: 409, ok: false }));

    await expect(
      updateVacancyProfile("v1", { technologies: [], seniorityLevel: "junior", keyCompetencies: [] }),
    ).rejects.toMatchObject({
      detail: "Esta vaga não pode mais ser ajustada.",
      hint: "A etapa da vaga já foi concluída.",
      retryable: false,
    });
  });

  it("409 in analysis context (not profile) -> falls through to generic fallback", async () => {
    mockFetchOnce(jsonResponse({}, { status: 409, ok: false }));

    await expect(getVacancy("v1")).rejects.toMatchObject({
      detail: "Não conseguimos acompanhar a análise (código 409).",
    });
  });

  it.each([
    ["save", "createVacancy", "O servidor não conseguiu salvar a vaga."],
    ["profile", "updateVacancyProfile", "O servidor não conseguiu salvar as alterações."],
    ["analysis", "getVacancy", "O servidor não conseguiu responder sobre a análise."],
  ] as const)("status >= 500 with context %s -> specific message", async (_ctx, _fn, message) => {
    mockFetchOnce(jsonResponse({}, { status: 500, ok: false }));

    let promise: Promise<unknown>;
    if (_fn === "createVacancy") promise = createVacancy("desc");
    else if (_fn === "updateVacancyProfile")
      promise = updateVacancyProfile("v1", { technologies: [], seniorityLevel: "junior", keyCompetencies: [] });
    else promise = getVacancy("v1");

    await expect(promise).rejects.toMatchObject({ detail: message, hint: "Costuma ser temporário." });
  });

  it.each([
    ["save", "createVacancy", "Não conseguimos salvar a vaga (código 418)."],
    ["profile", "updateVacancyProfile", "Não conseguimos salvar as alterações (código 418)."],
    ["analysis", "getVacancy", "Não conseguimos acompanhar a análise (código 418)."],
  ] as const)("unknown status fallback with context %s -> specific message with status embedded", async (_ctx, _fn, message) => {
    mockFetchOnce(jsonResponse({}, { status: 418, ok: false }));

    let promise: Promise<unknown>;
    if (_fn === "createVacancy") promise = createVacancy("desc");
    else if (_fn === "updateVacancyProfile")
      promise = updateVacancyProfile("v1", { technologies: [], seniorityLevel: "junior", keyCompetencies: [] });
    else promise = getVacancy("v1");

    await expect(promise).rejects.toMatchObject({ detail: message });
  });
});

describe("getVacancy / updateVacancyProfile network & parse errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getVacancy: network error", async () => {
    mockFetchRejectOnce();
    await expect(getVacancy("v1")).rejects.toMatchObject({
      detail: "Não conseguimos falar com o servidor do InterviewTrail.",
    });
  });

  it("getVacancy: malformed success body", async () => {
    const response = jsonResponse(null, { status: 200 });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);
    await expect(getVacancy("v1")).rejects.toMatchObject({
      detail: "O servidor respondeu num formato que não conseguimos ler.",
    });
  });

  it("updateVacancyProfile: network error", async () => {
    mockFetchRejectOnce();
    await expect(
      updateVacancyProfile("v1", { technologies: [], seniorityLevel: "junior", keyCompetencies: [] }),
    ).rejects.toMatchObject({ detail: "Não conseguimos falar com o servidor do InterviewTrail." });
  });
});

describe("reparseVacancy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("status 409 handled BEFORE the generic !response.ok path -> specific already-running message, bypassing mapErrorResponse", async () => {
    mockFetchOnce(jsonResponse({ message: "outra mensagem qualquer" }, { status: 409, ok: false }));

    await expect(reparseVacancy("v1")).rejects.toMatchObject({
      detail: "Esta análise já está rodando.",
      hint: "Aguarde ela terminar antes de pedir de novo.",
      retryable: false,
    });
  });

  it("other non-ok statuses still go through mapErrorResponse (analysis context)", async () => {
    mockFetchOnce(jsonResponse({}, { status: 500, ok: false }));

    await expect(reparseVacancy("v1")).rejects.toMatchObject({
      detail: "O servidor não conseguiu responder sobre a análise.",
    });
  });

  it("success -> returns the parsed vacancy", async () => {
    mockFetchOnce(jsonResponse(rawVacancy({ parseStatus: "pending" }), { status: 200 }));

    const vacancy = await reparseVacancy("v1");
    expect(vacancy.parseStatus).toBe("pending");
  });
});

describe("describeAnalysis", () => {
  function vacancyWith(parseStatus: Vacancy["parseStatus"], parseFailureReason: string | null = null): Vacancy {
    return {
      id: "v1",
      userId: "u1",
      rawDescription: "desc",
      parsedProfile: null,
      parseStatus,
      parseFailureReason,
      parsingCompleted: parseStatus !== "pending",
      createdAt: "2026-01-01T00:00:00Z",
    };
  }

  it("parseStatus done -> { state: 'ok' }", () => {
    expect(describeAnalysis(vacancyWith("done"))).toEqual({ state: "ok" });
  });

  it.each([
    ["invalid_api_key", false],
    ["timeout", true],
    ["invalid_response", true],
    ["ai_unavailable", true],
  ] as const)("parseStatus failed with reason %s -> retryable %s", (reason, retryable) => {
    const outcome = describeAnalysis(vacancyWith("failed", reason));
    expect(outcome.state).toBe("problem");
    if (outcome.state === "problem") {
      expect(outcome.retryable).toBe(retryable);
    }
  });

  it("parseStatus failed with unknown reason -> generic retryable message", () => {
    const outcome = describeAnalysis(vacancyWith("failed", "something_else"));
    expect(outcome).toMatchObject({
      state: "problem",
      detail: "A análise da vaga não pôde ser concluída.",
      retryable: true,
    });
  });

  it("parseStatus failed with null reason -> generic retryable message", () => {
    const outcome = describeAnalysis(vacancyWith("failed", null));
    expect(outcome).toMatchObject({
      state: "problem",
      detail: "A análise da vaga não pôde ser concluída.",
      retryable: true,
    });
  });

  it("parseStatus pending -> 'taking longer than expected', retryable true", () => {
    const outcome = describeAnalysis(vacancyWith("pending"));
    expect(outcome).toMatchObject({
      state: "problem",
      detail: "A análise está demorando mais do que o esperado.",
      retryable: true,
    });
  });
});

describe("waitForVacancyParsing", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns immediately when the vacancy is already parsed on the first call", async () => {
    const fetchMock = mockFetchOnce(jsonResponse(rawVacancy({ parseStatus: "done" }), { status: 200 }));

    const result = await waitForVacancyParsing("v1");

    expect(result.parsingCompleted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("polls at POLL_INTERVAL_MS until parsingCompleted becomes true", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(rawVacancy({ parseStatus: "pending" }), { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(rawVacancy({ parseStatus: "pending" }), { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(rawVacancy({ parseStatus: "done" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = waitForVacancyParsing("v1");

    await vi.advanceTimersByTimeAsync(1200);
    await vi.advanceTimersByTimeAsync(1200);

    const result = await promise;
    expect(result.parseStatus).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns the last known (pending) state without throwing once POLL_TIMEOUT_MS is reached", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rawVacancy({ parseStatus: "pending" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = waitForVacancyParsing("v1");

    await vi.advanceTimersByTimeAsync(46_000);

    const result = await promise;
    expect(result.parseStatus).toBe("pending");
    expect(result.parsingCompleted).toBe(false);
  });

  it("resolves immediately without waiting the full interval when the AbortSignal aborts mid-wait", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rawVacancy({ parseStatus: "pending" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    const promise = waitForVacancyParsing("v1", controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    const result = await promise;
    expect(result.parseStatus).toBe("pending");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns immediately when signal.aborted is already true before the loop", async () => {
    const fetchMock = mockFetchOnce(jsonResponse(rawVacancy({ parseStatus: "pending" }), { status: 200 }));
    const controller = new AbortController();
    controller.abort();

    const result = await waitForVacancyParsing("v1", controller.signal);

    expect(result.parseStatus).toBe("pending");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

