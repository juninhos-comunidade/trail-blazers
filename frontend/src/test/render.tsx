import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { AuthProvider } from "../auth/AuthProvider";
import { ThemeProvider } from "../theme/ThemeProvider";
import { TOKEN_STORAGE_KEY } from "../auth/auth-context";
import { signTestToken, type TestJwtPayload } from "./jwt-helpers";

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  /** Se fornecido, grava um token válido no localStorage antes de montar (usuário autenticado). */
  authPayload?: TestJwtPayload | null;
}

/** Autentica o "usuário" gravando um JWT válido no localStorage antes da renderização. */
export function signInAs(payload: TestJwtPayload = {}): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, signTestToken(payload));
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", authPayload, ...options }: RenderWithProvidersOptions = {},
) {
  if (authPayload) {
    signInAs(authPayload);
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export * from "@testing-library/react";
