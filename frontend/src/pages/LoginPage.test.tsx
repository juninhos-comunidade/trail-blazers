import { useEffect } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";
import { useAuth } from "../auth/useAuth";
import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { renderWithProviders, render, screen } from "../test/render";
import type { SessionEndReason } from "../auth/auth-context";

const { githubButtonSpy } = vi.hoisted(() => ({ githubButtonSpy: vi.fn() }));

vi.mock("../components/auth/GitHubSignInButton", () => ({
  GitHubSignInButton: (props: { redirectTo?: string }) => {
    githubButtonSpy(props.redirectTo);
    return <button type="button">Entrar com GitHub</button>;
  },
}));

function SeedSessionEndReason({ reason }: { reason: SessionEndReason }) {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut(reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function renderLogin({
  route = "/login",
  sessionEndReason,
}: { route?: string; sessionEndReason?: SessionEndReason } = {}) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/login"
        element={
          <>
            {sessionEndReason && <SeedSessionEndReason reason={sessionEndReason} />}
            <LoginPage />
          </>
        }
      />
    </Routes>,
    { route },
  );
}

describe("LoginPage", () => {
  it("renders no Alert when there is no query error and no sessionEndReason", () => {
    renderLogin();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the expired-session message when sessionEndReason is 'expired' and there's no URL error", async () => {
    renderLogin({ sessionEndReason: "expired" });

    expect(
      await screen.findByText(/Sua sessão expirou por segurança/),
    ).toBeInTheDocument();
  });

  it("shows the invalid-session message when sessionEndReason is 'invalid' and there's no URL error", async () => {
    renderLogin({ sessionEndReason: "invalid" });

    expect(
      await screen.findByText(/Não foi possível validar sua sessão/),
    ).toBeInTheDocument();
  });

  it("prioritizes the `erro` query param over sessionEndReason", async () => {
    renderLogin({ route: "/login?erro=access_denied", sessionEndReason: "expired" });

    expect(await screen.findByText(/Você cancelou a autorização/)).toBeInTheDocument();
    expect(screen.queryByText(/Sua sessão expirou por segurança/)).not.toBeInTheDocument();
  });

  it("extracts redirectTo from location.state.from.pathname and passes it to GitHubSignInButton", () => {
    render(
      <ThemeProvider>
        <MemoryRouter
          initialEntries={[
            { pathname: "/login", state: { from: { pathname: "/dashboard" } } },
          ]}
        >
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(githubButtonSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("passes redirectTo=undefined to GitHubSignInButton when there's no navigation state", () => {
    renderWithProviders(<LoginPage />, { route: "/login" });

    expect(githubButtonSpy).toHaveBeenCalledWith(undefined);
  });
});
