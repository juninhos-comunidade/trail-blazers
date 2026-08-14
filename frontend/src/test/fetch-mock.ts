import { vi } from "vitest";

/** Monta um `Response`-like resolvido por `fetch`, com `.json()`/`.blob()` prontos. */
export function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
    headers: new Headers({ "content-type": "application/json" }),
  } as unknown as Response;
}

export function mockFetchOnce(response: Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

export function mockFetchRejectOnce(error: unknown = new TypeError("network error")): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockRejectedValueOnce(error);
  vi.stubGlobal("fetch", fn);
  return fn;
}
