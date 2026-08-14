import { StrictMode } from "react";
import { Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AuthCallbackPage } from "./AuthCallbackPage";
import { renderWithProviders, screen } from "../test/render";
import { signTestToken } from "../test/jwt-helpers";

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
});

describe("AuthCallbackPage", () => {
  it("redirects to login with the error code when `error` is present in the URL", async () => {
    renderCallback("/auth/success?error=access_denied");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("redirects to login with erro=sem_token when there's no error and no token", async () => {
    renderCallback("/auth/success");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("redirects to login with erro=token_invalido when signIn fails", async () => {
    renderCallback("/auth/success?token=not-a-real-jwt");

    expect(await screen.findByText("página de login")).toBeInTheDocument();
  });

  it("navigates to the dashboard when signIn succeeds and there's no pending redirect", async () => {
    const token = signTestToken();
    renderCallback(`/auth/success?token=${token}`);

    expect(await screen.findByText("painel")).toBeInTheDocument();
  });

  it("navigates to the pending redirect when signIn succeeds and one was saved", async () => {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, "/em-outro-lugar");
    const token = signTestToken();
    renderCallback(`/auth/success?token=${token}`);

    expect(await screen.findByText("destino do redirect salvo")).toBeInTheDocument();
  });

  it("only runs its redirect logic once, even under StrictMode double-invoke", async () => {
    // consumeRedirectAfterLogin() removes the stored key on first read, so if
    // the effect ran twice (missing the `handled` ref guard), the second run
    // would find no saved redirect and fall back to the dashboard instead —
    // this scenario is the most sensitive way to catch a double-invocation.
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, "/em-outro-lugar");
    const token = signTestToken();
    renderCallback(`/auth/success?token=${token}`, { strict: true });

    expect(await screen.findByText("destino do redirect salvo")).toBeInTheDocument();
    expect(screen.queryByText("painel")).not.toBeInTheDocument();
  });
});
