import { TOKEN_STORAGE_KEY } from "./auth-context";

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // best-effort — sem storage, a sessão não sobrevive a um reload
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // best-effort — nada a fazer se o storage já está indisponível
  }
}
