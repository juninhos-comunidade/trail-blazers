import { API_URL } from "../lib/env";

const REDIRECT_STORAGE_KEY = "interviewtrail:redirect-after-login";

/**
 * Início do fluxo OAuth (RF-1.1). É uma navegação de página inteira, e não um
 * fetch: quem monta o `authorize` do GitHub — com os escopos certos e o
 * `state` — é o backend, em `GET /auth/github`.
 *
 * O destino pretendido não sobrevive ao round-trip pelo GitHub, então fica no
 * sessionStorage até a volta em `/auth/success`.
 */
export function startGithubOAuth(redirectTo?: string): void {
  if (redirectTo) {
    try {
      sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirectTo);
    } catch {
      // Sem storage o login segue normal, só cai no destino padrão.
    }
  }

  window.location.href = `${API_URL}/auth/github`;
}

/** Lê e descarta o destino guardado antes do redirect para o GitHub. */
export function consumeRedirectAfterLogin(): string | null {
  try {
    const redirectTo = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    sessionStorage.removeItem(REDIRECT_STORAGE_KEY);

    // Só caminhos internos: um destino absoluto viraria open redirect.
    return redirectTo?.startsWith("/") ? redirectTo : null;
  } catch {
    return null;
  }
}
