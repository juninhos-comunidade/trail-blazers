import { writeToken } from "@auth/token-storage";
import { clearVacancyDraft } from "@lib/interview-draft";
import { writeTtsPreference } from "@lib/tts-preference";

import { installDemoApi, resetDemoState } from "./demo-api";
import { demoUser } from "./demo-data";
import { DEMO_MODE } from "./demo-flag";

function base64url(value: string): string {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * JWT de mentira: o app só lê o payload (nunca valida assinatura), então isso
 * basta para o `AuthProvider` considerar a sessão válida durante a demo.
 */
function fakeToken(): string {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: demoUser.id,
      username: demoUser.username,
      email: demoUser.email,
      avatarUrl: demoUser.avatarUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    }),
  );

  return `${header}.${payload}.demo-signature`;
}

/**
 * Prepara a demonstração ANTES do React montar: backend falso no lugar,
 * usuário "logado" e rascunhos da sessão anterior zerados.
 */
export function bootDemo(): void {
  if (!DEMO_MODE) return;

  installDemoApi();
  resetDemoState();
  clearVacancyDraft();
  writeToken(fakeToken());
  // A leitura em voz alta depende de um gesto do usuário para tocar áudio;
  // numa demo sem cliques ela só atrapalharia.
  writeTtsPreference(false);
}
