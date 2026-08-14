import { API_URL } from "../lib/env";

const REDIRECT_STORAGE_KEY = "interviewtrail:redirect-after-login";

export function startGithubOAuth(redirectTo?: string): void {
  if (redirectTo) {
    try {
      sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirectTo);
    } catch {
      // best-effort — sem storage, só perde o redirect pós-login
    }
  }

  window.location.href = `${API_URL}/auth/github`;
}

/**
 * O redirect do OAuth traz só um código de uso único (não o token — assim
 * ele não fica exposto na URL, no histórico do navegador nem em logs).
 * Esta troca acontece uma única vez, por POST.
 */
export async function exchangeLoginCode(code: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error("Código de login inválido ou expirado.");
  }

  const data = (await response.json()) as { accessToken: string };
  return data.accessToken;
}

export function consumeRedirectAfterLogin(): string | null {
  try {
    const redirectTo = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    sessionStorage.removeItem(REDIRECT_STORAGE_KEY);

    return redirectTo?.startsWith("/") ? redirectTo : null;
  } catch {
    return null;
  }
}
