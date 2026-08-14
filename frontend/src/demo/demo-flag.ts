/**
 * Modo demonstração (pitch).
 *
 * Nesta branch o modo vem LIGADO por padrão: abrir http://localhost:3001 já
 * dispara o fluxo completo automaticamente, com dados mockados.
 *
 * Para desligar:
 *   - abra http://localhost:3001/?demo=off  (fica desligado até fechar a aba)
 *   - ou rode o front com VITE_DEMO_MODE=false
 *
 * Outras chaves aceitas na URL:
 *   ?demo=on    liga de novo
 *   ?demo=once  roda o fluxo uma vez e não reinicia no final
 */

const DISABLED_KEY = "interviewtrail.demo-disabled";
const ONCE_KEY = "interviewtrail.demo-once";

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    sessionStorage.setItem(key, value ? "1" : "0");
  } catch {}
}

function resolve(): { enabled: boolean; loop: boolean } {
  const envValue = import.meta.env.VITE_DEMO_MODE;
  const envDisabled = envValue === "false" || envValue === "0";

  let param: string | null = null;

  try {
    param = new URLSearchParams(window.location.search).get("demo");
  } catch {}

  if (param === "off" || param === "0" || param === "false") {
    writeFlag(DISABLED_KEY, true);
  } else if (param === "on" || param === "1" || param === "true") {
    writeFlag(DISABLED_KEY, false);
    writeFlag(ONCE_KEY, false);
  } else if (param === "once") {
    writeFlag(DISABLED_KEY, false);
    writeFlag(ONCE_KEY, true);
  }

  return {
    enabled: !envDisabled && !readFlag(DISABLED_KEY),
    loop: !readFlag(ONCE_KEY),
  };
}

const resolved = resolve();

/** O modo demonstração está ativo nesta aba? */
export const DEMO_MODE = resolved.enabled;

/** Ao terminar o fluxo, recomeça do zero (bom para um totem no evento). */
export const DEMO_LOOP = resolved.loop;
