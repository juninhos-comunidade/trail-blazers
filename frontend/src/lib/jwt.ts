/**
 * Leitura do payload de um JWT — sem verificação de assinatura.
 *
 * Só serve para o frontend saber quem está logado e quando a sessão expira.
 * Quem valida o token de verdade é o backend, a cada requisição protegida.
 */
export interface JwtPayload {
  sub: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  /** Expiração em segundos desde a época Unix. */
  exp?: number;
  iat?: number;
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );

  // atob devolve bytes latin-1; o passo por URI-encoding recupera o UTF-8
  // original (nomes de usuário com acento, por exemplo).
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sub === "string" && typeof payload.username === "string"
  );
}

export function decodeJwt(token: string): JwtPayload | null {
  const segments = token.split(".");

  if (segments.length !== 3) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(decodeBase64Url(segments[1]));
    return isJwtPayload(payload) ? payload : null;
  } catch {
    // Token corrompido ou fora do formato esperado: tratamos como inválido.
    return null;
  }
}

/** Momento da expiração em milissegundos, ou `null` se o token não expirar. */
export function getExpiresAt(payload: JwtPayload): number | null {
  return typeof payload.exp === "number" ? payload.exp * 1000 : null;
}

export function isExpired(payload: JwtPayload, now = Date.now()): boolean {
  const expiresAt = getExpiresAt(payload);
  return expiresAt !== null && expiresAt <= now;
}
