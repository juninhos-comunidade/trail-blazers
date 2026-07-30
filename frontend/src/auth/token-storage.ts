import { TOKEN_STORAGE_KEY } from "./auth-context";

/**
 * Acesso ao token isolado num módulo só: o localStorage pode lançar (modo
 * privativo, storage cheio) e nenhuma tela precisa saber disso.
 */
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
    // Sessão continua válida nesta aba, só não sobrevive a um reload.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nada a fazer: o estado em memória já foi limpo por quem chamou.
  }
}
