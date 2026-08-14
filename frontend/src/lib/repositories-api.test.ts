import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOKEN_STORAGE_KEY } from "../auth/auth-context";
import { jsonResponse, mockFetchOnce, mockFetchRejectOnce } from "../test/fetch-mock";
import { API_URL } from "./env";
import { fetchRepos } from "./repositories-api";

describe("fetchRepos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the parsed repo list on success", async () => {
    const repos = [
      { id: 1, owner: "acme", name: "repo", description: null, language: null, visibility: "public" },
    ];
    mockFetchOnce(jsonResponse(repos, { status: 200 }));

    await expect(fetchRepos()).resolves.toEqual(repos);
  });

  it("includes Authorization header when a token is present", async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, "tok-abc");
    const fetchMock = mockFetchOnce(jsonResponse([], { status: 200 }));

    await fetchRepos();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}/repositories`);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok-abc" });
  });

  it("omits Authorization header when there is no token", async () => {
    const fetchMock = mockFetchOnce(jsonResponse([], { status: 200 }));

    await fetchRepos();

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toEqual({});
  });

  it("throws a network-error RepositoriesError when fetch rejects", async () => {
    mockFetchRejectOnce();

    await expect(fetchRepos()).rejects.toMatchObject({
      name: "RepositoriesError",
      detail: "Não conseguimos falar com o servidor do InterviewTrail.",
      hint: "Verifique sua conexão e tente de novo.",
      retryable: true,
    });
  });

  it("throws a parse-error RepositoriesError when the success body is malformed", async () => {
    const response = jsonResponse(null, { status: 200 });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);

    await expect(fetchRepos()).rejects.toMatchObject({
      name: "RepositoriesError",
      detail: "O servidor respondeu num formato que não conseguimos ler.",
    });
  });

  describe("mapErrorResponse via non-ok responses", () => {
    it.each([401, 403])("status %d -> invalid github session, not retryable", async (status) => {
      mockFetchOnce(jsonResponse({}, { status, ok: false }));

      await expect(fetchRepos()).rejects.toMatchObject({
        detail: "Sua sessão com o GitHub não é mais válida.",
        hint: "Saia e entre de novo para renovar o acesso.",
        retryable: false,
      });
    });

    it("status 429 -> rate limited with hint from retryAfterSeconds", async () => {
      mockFetchOnce(jsonResponse({ retryAfterSeconds: 61 }, { status: 429, ok: false }));

      await expect(fetchRepos()).rejects.toMatchObject({
        detail: "O GitHub limitou nossas requisições por agora.",
        hint: "Tente de novo em cerca de 2 minutos.",
        retryable: true,
      });
    });

    it("status 429 without retryAfterSeconds -> generic retry hint", async () => {
      mockFetchOnce(jsonResponse({}, { status: 429, ok: false }));

      await expect(fetchRepos()).rejects.toMatchObject({
        hint: "Tente de novo em alguns instantes.",
      });
    });

    it("code limite_github_atingido on a non-429 status still maps to rate-limited branch", async () => {
      mockFetchOnce(
        jsonResponse({ code: "limite_github_atingido", retryAfterSeconds: 30 }, { status: 400, ok: false }),
      );

      await expect(fetchRepos()).rejects.toMatchObject({
        detail: "O GitHub limitou nossas requisições por agora.",
        hint: "Tente de novo em cerca de um minuto.",
      });
    });

    it("status >= 500 -> generic server error, retryable true by default", async () => {
      mockFetchOnce(jsonResponse({}, { status: 502, ok: false }));

      await expect(fetchRepos()).rejects.toMatchObject({
        detail: "O servidor não conseguiu responder à busca no GitHub.",
        hint: "Costuma ser temporário.",
        retryable: true,
      });
    });

    it("status >= 500 uses body.message when present", async () => {
      mockFetchOnce(jsonResponse({ message: "Erro específico" }, { status: 500, ok: false }));

      await expect(fetchRepos()).rejects.toMatchObject({ detail: "Erro específico" });
    });

    it("unknown status -> generic fallback message with the status code", async () => {
      mockFetchOnce(jsonResponse({}, { status: 418, ok: false }));

      await expect(fetchRepos()).rejects.toMatchObject({
        detail: "A busca falhou com o código 418.",
      });
    });

    it("non-ok response with unparseable body still maps correctly with body: null", async () => {
      const response = jsonResponse(null, { status: 500, ok: false });
      response.json = () => Promise.reject(new Error("bad json"));
      mockFetchOnce(response);

      await expect(fetchRepos()).rejects.toMatchObject({
        detail: "O servidor não conseguiu responder à busca no GitHub.",
      });
    });
  });
});

describe("describeRetryAfter (via mapErrorResponse hints)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("undefined seconds -> generic hint (undefined from describeRetryAfter)", async () => {
    mockFetchOnce(jsonResponse({}, { status: 429, ok: false }));
    await expect(fetchRepos()).rejects.toMatchObject({
      hint: "Tente de novo em alguns instantes.",
    });
  });

  it("seconds <= 0 -> generic hint", async () => {
    mockFetchOnce(jsonResponse({ retryAfterSeconds: 0 }, { status: 429, ok: false }));
    await expect(fetchRepos()).rejects.toMatchObject({
      hint: "Tente de novo em alguns instantes.",
    });
  });

  it("60 seconds -> exact-boundary singular message", async () => {
    mockFetchOnce(jsonResponse({ retryAfterSeconds: 60 }, { status: 429, ok: false }));
    await expect(fetchRepos()).rejects.toMatchObject({
      hint: "Tente de novo em cerca de um minuto.",
    });
  });

  it("61 seconds -> rounds up to 2 minutes", async () => {
    mockFetchOnce(jsonResponse({ retryAfterSeconds: 61 }, { status: 429, ok: false }));
    await expect(fetchRepos()).rejects.toMatchObject({
      hint: "Tente de novo em cerca de 2 minutos.",
    });
  });
});

