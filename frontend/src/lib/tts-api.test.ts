import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOKEN_STORAGE_KEY } from "../auth/auth-context";
import { jsonResponse, mockFetchOnce, mockFetchRejectOnce } from "../test/fetch-mock";
import { API_URL } from "./env";
import { synthesizeSpeech, TtsError } from "./tts-api";

describe("synthesizeSpeech", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a Blob on success", async () => {
    const fetchMock = mockFetchOnce(jsonResponse({ ok: true }, { status: 200 }));

    const blob = await synthesizeSpeech("olá mundo");

    expect(blob).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/tts/speak`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "olá mundo" }),
      }),
    );
  });

  it("throws a TtsError with reason network_error when fetch rejects", async () => {
    mockFetchRejectOnce();

    await expect(synthesizeSpeech("oi")).rejects.toMatchObject({
      name: "Error",
      reason: "network_error",
      message: "Não foi possível conectar ao leitor de voz do servidor.",
    });
  });

  it("uses message/reason from the response body when not ok", async () => {
    mockFetchOnce(
      jsonResponse(
        { message: "Serviço de voz indisponível.", reason: "unavailable" },
        { status: 503, ok: false },
      ),
    );

    let caught: unknown;
    try {
      await synthesizeSpeech("oi");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(TtsError);
    expect((caught as TtsError).message).toBe("Serviço de voz indisponível.");
    expect((caught as TtsError).reason).toBe("unavailable");
  });

  it("falls back to defaults when the error body isn't parseable", async () => {
    const response = jsonResponse(null, { status: 500, ok: false });
    response.json = () => Promise.reject(new Error("bad json"));
    mockFetchOnce(response);

    await expect(synthesizeSpeech("oi")).rejects.toMatchObject({
      message: "TTS respondeu 500",
      reason: "unknown",
    });
  });

  describe("Authorization header", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("includes Authorization when a token is present", async () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, "tok-123");
      const fetchMock = mockFetchOnce(jsonResponse({}, { status: 200 }));

      await synthesizeSpeech("oi");

      const [, init] = fetchMock.mock.calls[0];
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: "Bearer tok-123",
      });
    });

    it("omits Authorization when there is no token", async () => {
      const fetchMock = mockFetchOnce(jsonResponse({}, { status: 200 }));

      await synthesizeSpeech("oi");

      const [, init] = fetchMock.mock.calls[0];
      expect((init as RequestInit).headers).not.toHaveProperty("Authorization");
    });
  });
});
