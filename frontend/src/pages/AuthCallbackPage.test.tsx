import { StrictMode } from "react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthCallbackPage } from "./AuthCallbackPage";
import { renderWithProviders, screen } from "../test/render";
import { signTestToken } from "../test/jwt-helpers";
import { jsonResponse, mockFetchOnce, mockFetchRejectOnce } from "../test/fetch-mock";

function Login() {
  return <div>página de login</div>;
}

function Dashboard() {
  return <div>painel</div>;
}

function Wherever() {
  return <div>destino do redirect salvo</div>;
}

function renderCallback(route: string, { strict = false }: { strict?: boolean } = {}) {
  const ui = (
    <Routes>
      <Route path="/auth/success" element={<AuthCallbackPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/em-outro-lugar" element={<Wherever />} />
    </Routes>
  );

  return renderWithProviders(strict ? <StrictMode>{ui}</StrictMode> : ui, { route });
}

const REDIRECT_STORAGE_KEY = "interviewtrail:redirect-after-login";

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthCallbackPage", () => {
  it("redirects to login with the error code when `error` is present in the URL", async () => {
    renderCallback("/auth/success?error=access_denied");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("redirects to login with erro=sem_token when there's no error and no code", async () => {
    renderCallback("/auth/success");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("redirects to login with erro=token_invalido when the code exchange fails", async () => {
    mockFetchRejectOnce();
    renderCallback("/auth/success?code=codigo-invalido");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("redirects to login with erro=token_invalido when the exchanged token isn't a valid JWT", async () => {
    mockFetchOnce(jsonResponse({ accessToken: "not-a-real-jwt" }));
    renderCallback("/auth/success?code=codigo-de-uso-unico");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("navigates to the dashboard when the exchange succeeds and there's no pending redirect", async () => {
    const token = signTestToken();
    mockFetchOnce(jsonResponse({ accessToken: token }));
    renderCallback("/auth/success?code=codigo-de-uso-unico");

    expect(await screen.findByText("painel")).toBeInTheDocument();
  });

  it("navigates to the pending redirect when the exchange succeeds and one was saved", async () => {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, "/em-outro-lugar");
    const token = signTestToken();
    mockFetchOnce(jsonResponse({ accessToken: token }));
    renderCallback("/auth/success?code=codigo-de-uso-unico");

    expect(await screen.findByText("destino do redirect salvo")).toBeInTheDocument();
  });

  it("only runs its redirect logic once, even under StrictMode double-invoke", async () => {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, "/em-outro-lugar");
    const token = signTestToken();
    mockFetchOnce(jsonResponse({ accessToken: token }));
    renderCallback("/auth/success?code=codigo-de-uso-unico", { strict: true });

    expect(await screen.findByText("destino do redirect salvo")).toBeInTheDocument();
    expect(screen.queryByText("painel")).not.toBeInTheDocument();
  });
});
