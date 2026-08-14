import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { TOKEN_STORAGE_KEY } from "./auth/auth-context";
import { signTestToken } from "./test/jwt-helpers";

const { listSessionsMock } = vi.hoisted(() => ({ listSessionsMock: vi.fn() }));

vi.mock("@lib/interview-api", async () => {
  const actual = await vi.importActual<typeof import("@lib/interview-api")>(
    "@lib/interview-api",
  );
  return { ...actual, listSessions: listSessionsMock, getSession: vi.fn() };
});

function goTo(path: string) {
  window.history.pushState({}, "", path);
}

function signIn() {
  localStorage.setItem(TOKEN_STORAGE_KEY, signTestToken());
}

afterEach(() => {
  localStorage.clear();
  listSessionsMock.mockReset();
  window.history.pushState({}, "", "/");
});

describe("App routing/guard composition", () => {
  it("renders the landing page at `/` without authentication", () => {
    goTo("/");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Chegue preparado para a entrevista técnica/ }),
    ).toBeInTheDocument();
  });

  it("renders the auth callback page at /auth/success without authentication", () => {
    goTo("/auth/success");
    render(<App />);

    expect(screen.getByText(/Entrar no Interview/)).toBeInTheDocument();
  });

  it("redirects an authenticated user away from /login to the dashboard", async () => {
    listSessionsMock.mockResolvedValue([]);
    signIn();
    goTo("/login");
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText("Sua trilha começa aqui.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Entrar no Interview/)).not.toBeInTheDocument();
  });

  it("shows the login page at /login for an unauthenticated user", () => {
    goTo("/login");
    render(<App />);

    expect(screen.getByText(/Entrar no Interview/)).toBeInTheDocument();
  });

  it("redirects to /login when navigating to /dashboard unauthenticated", () => {
    goTo("/dashboard");
    render(<App />);

    expect(screen.getByText(/Entrar no Interview/)).toBeInTheDocument();
  });

  it("redirects to /login when navigating to an interview-flow route unauthenticated", () => {
    goTo("/entrevista/vaga");
    render(<App />);

    expect(screen.getByText(/Entrar no Interview/)).toBeInTheDocument();
  });

  it("renders GuardedFallback for an unknown path: redirects to landing when unauthenticated", () => {
    goTo("/nao-existe");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /Chegue preparado para a entrevista técnica/ }),
    ).toBeInTheDocument();
  });

  it("renders GuardedFallback for an unknown path: shows UnderConstructionPage when authenticated", () => {
    signIn();
    goTo("/nao-existe");
    render(<App />);

    expect(
      screen.getByText("Esta etapa da trilha ainda está sendo construída."),
    ).toBeInTheDocument();
  });
});
