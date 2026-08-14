/** Utilidades que o piloto automático usa para agir na tela como um usuário. */

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isVisible(element: Element | null | undefined): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Espera algo aparecer na tela. Devolve `null` se estourar o tempo. */
export async function waitFor<T>(
  probe: () => T | null | undefined,
  { timeout = 15_000, interval = 80 } = {},
): Promise<T | null> {
  const deadline = Date.now() + timeout;

  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(interval);
  }
}

function normalize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Procura um elemento clicável pelo texto visível (comparação parcial). */
export function findByText(selector: string, text: string): HTMLElement | null {
  const wanted = normalize(text);

  const match = Array.from(document.querySelectorAll(selector)).find(
    (element) => isVisible(element) && normalize(element.textContent).includes(wanted),
  );

  return (match as HTMLElement) ?? null;
}

export function findByLabel(selector: string, label: string): HTMLElement | null {
  const wanted = normalize(label);

  const match = Array.from(document.querySelectorAll(selector)).find(
    (element) => isVisible(element) && normalize(element.getAttribute("aria-label")) === wanted,
  );

  return (match as HTMLElement) ?? null;
}

export async function scrollIntoView(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(300);
}

/**
 * Escreve texto no campo como se estivesse sendo digitado. O React só percebe
 * a mudança se o valor for gravado pelo setter nativo antes do evento `input`.
 */
export async function typeInto(
  element: HTMLTextAreaElement | HTMLInputElement,
  text: string,
  durationMs: number,
): Promise<void> {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const setValue = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setValue) return;

  element.focus();

  const tick = 28;
  const steps = Math.max(1, Math.round(durationMs / tick));
  const chunk = Math.max(1, Math.ceil(text.length / steps));

  for (let index = chunk; index <= text.length + chunk; index += chunk) {
    const value = text.slice(0, Math.min(index, text.length));
    setValue.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    if (index >= text.length) break;
    await sleep(tick);
  }
}

/** Rola suavemente até o fim do container (ou da janela) no tempo pedido. */
export async function scrollThrough(
  target: HTMLElement | Window,
  durationMs: number,
): Promise<void> {
  const start = performance.now();

  const read = () => {
    if (target instanceof Window) {
      return {
        top: window.scrollY,
        max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      };
    }
    return { top: target.scrollTop, max: Math.max(0, target.scrollHeight - target.clientHeight) };
  };

  const from = read().top;

  for (;;) {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
    const { max } = read();
    const top = from + (max - from) * eased;

    if (target instanceof Window) window.scrollTo({ top, behavior: "auto" });
    else target.scrollTop = top;

    if (progress >= 1) break;
    await sleep(16);
  }
}

// --- Cursor falso ----------------------------------------------------------

let cursor: HTMLElement | null = null;

function ensureCursor(): HTMLElement {
  if (cursor?.isConnected) return cursor;

  cursor = document.createElement("div");
  cursor.dataset.demoCursor = "true";
  cursor.setAttribute("aria-hidden", "true");
  cursor.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:20px",
    "height:20px",
    "margin:-10px 0 0 -10px",
    "border-radius:9999px",
    "background:rgba(255,255,255,0.9)",
    "border:2px solid rgba(20,20,20,0.55)",
    "box-shadow:0 2px 10px rgba(0,0,0,0.35)",
    "pointer-events:none",
    "z-index:2147483000",
    "opacity:0",
    "transition:transform 360ms cubic-bezier(0.22,0.61,0.36,1),opacity 200ms ease,width 120ms ease,height 120ms ease",
  ].join(";");

  document.body.appendChild(cursor);
  return cursor;
}

export function showCursor(): void {
  const element = ensureCursor();
  element.style.opacity = "1";
}

export function hideCursor(): void {
  if (cursor) cursor.style.opacity = "0";
}

export function removeCursor(): void {
  cursor?.remove();
  cursor = null;
}

export async function moveCursorTo(element: HTMLElement): Promise<void> {
  const pointer = ensureCursor();
  const rect = element.getBoundingClientRect();
  pointer.style.opacity = "1";
  pointer.style.transform = `translate(${rect.left + rect.width / 2}px, ${rect.top + rect.height / 2}px)`;
  await sleep(380);
}

async function pressAnimation(): Promise<void> {
  const pointer = ensureCursor();
  pointer.style.width = "13px";
  pointer.style.height = "13px";
  await sleep(90);
  pointer.style.width = "20px";
  pointer.style.height = "20px";
}

/** Leva o cursor até o elemento, "aperta" e dispara o clique de verdade. */
export async function clickWithCursor(element: HTMLElement): Promise<void> {
  await scrollIntoView(element);
  await moveCursorTo(element);
  await pressAnimation();
  element.click();
  await sleep(80);
}
