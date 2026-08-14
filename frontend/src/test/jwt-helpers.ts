function base64url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface TestJwtPayload {
  sub?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  exp?: number;
  iat?: number;
}

/** Gera um JWT sintático válido (header.payload.assinatura) para testes, sem assinatura real. */
export function signTestToken(payload: TestJwtPayload = {}): string {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      sub: "user-1",
      username: "octocat",
      ...payload,
    }),
  );

  return `${header}.${body}.signature`;
}
