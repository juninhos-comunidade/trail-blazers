import { paths } from "@routes/paths";

import { demoQuestions, demoSelectedRepo, demoVacancyDescription } from "./demo-data";
import {
  clickWithCursor,
  findByLabel,
  findByText,
  hideCursor,
  scrollThrough,
  showCursor,
  sleep,
  typeInto,
  waitFor,
} from "./demo-dom";

/**
 * Roteiro da demonstração automática.
 *
 * Um "usuário" invisível percorre o produto inteiro: landing → dashboard →
 * descrição da vaga → escolha do repositório → entrevista → relatório.
 * Tudo em torno de 40 segundos, com o backend falso de `demo-api`.
 *
 * Os tempos abaixo são o roteiro do pitch — mexa aqui para acelerar ou
 * desacelerar qualquer trecho.
 */
const TIMELINE = {
  intro: 600,
  landingScroll: 3_400,
  dashboardRead: 1_400,
  vacancyRead: 400,
  vacancyTyping: 2_000,
  profileRead: 1_500,
  repoRead: 800,
  repoConfirm: 250,
  questionRead: 700,
  answerTyping: 1_100,
  answerSettle: 300,
  closingRead: 1_100,
  reportRead: 800,
  reportScroll: 3_200,
};

export const demoSteps = [
  { id: "landing", label: "Landing page" },
  { id: "dashboard", label: "Dashboard" },
  { id: "vacancy", label: "Descrição da vaga" },
  { id: "repos", label: "Repositórios" },
  { id: "interview", label: "Entrevista" },
  { id: "report", label: "Relatório" },
] as const;

export type DemoStepId = (typeof demoSteps)[number]["id"];

export interface DemoRunner {
  onStep: (step: DemoStepId) => void;
  onFinish: () => void;
  onAbort: (reason: string) => void;
  navigate: (to: string) => void;
}

class DemoAborted extends Error {}

let claimed = false;

/**
 * Só o primeiro chamador ganha o direito de rodar o roteiro — evita duas
 * execuções simultâneas quando o StrictMode monta o app duas vezes em dev.
 */
export function claimDemoRun(): boolean {
  if (claimed) return false;
  claimed = true;
  return true;
}

/** Espera o elemento aparecer; se não aparecer, derruba o roteiro com um aviso. */
async function need<T>(probe: () => T | null, description: string, timeout = 15_000): Promise<T> {
  const value = await waitFor(probe, { timeout });
  if (!value) throw new DemoAborted(description);
  return value;
}

function outletScroller(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("div.overflow-y-auto"),
  );

  return candidates.find((element) => element.scrollHeight > element.clientHeight) ?? null;
}

async function runLanding(runner: DemoRunner): Promise<void> {
  runner.onStep("landing");

  if (window.location.pathname !== paths.landing) {
    runner.navigate(paths.landing);
    await sleep(300);
  }

  window.scrollTo({ top: 0 });
  showCursor();
  await sleep(TIMELINE.intro);
  await scrollThrough(window, TIMELINE.landingScroll);

  const cta = await need(
    () => findByText("a", "Ir para o dashboard"),
    "não achei o botão de entrar na landing",
  );

  await clickWithCursor(cta);
}

async function runDashboard(runner: DemoRunner): Promise<void> {
  runner.onStep("dashboard");

  await need(() => findByText("h1", "Olá,"), "o dashboard não carregou");
  window.scrollTo({ top: 0 });
  await sleep(TIMELINE.dashboardRead);

  const newInterview = await need(
    () => findByText("a", "Nova entrevista"),
    "não achei o botão de nova entrevista",
  );

  await clickWithCursor(newInterview);
}

async function runVacancy(runner: DemoRunner): Promise<void> {
  runner.onStep("vacancy");

  const textarea = await need(
    () => findByLabel("textarea", "Descrição da vaga") as HTMLTextAreaElement | null,
    "não achei o campo da descrição da vaga",
  );

  await sleep(TIMELINE.vacancyRead);
  await typeInto(textarea, demoVacancyDescription, TIMELINE.vacancyTyping);

  const save = await need(
    () => findByText("button", "Salvar vaga"),
    "não achei o botão de salvar a vaga",
  );
  await clickWithCursor(save);

  // A IA "lê" a vaga e devolve o perfil técnico extraído.
  await need(() => findByText("span", "Vaga salva"), "a análise da vaga não terminou");
  await need(() => findByText("dd", "Júnior"), "o perfil da vaga não apareceu");
  await sleep(TIMELINE.profileRead);

  const next = await need(
    () => findByText("button", "Continuar"),
    "não achei o botão de continuar",
  );
  await clickWithCursor(next);
}

async function runRepositories(runner: DemoRunner): Promise<void> {
  runner.onStep("repos");

  const card = await need(
    () =>
      findByLabel(
        '[role="checkbox"]',
        `${demoSelectedRepo.owner}/${demoSelectedRepo.name}`,
      ),
    "a lista de repositórios não carregou",
  );

  await sleep(TIMELINE.repoRead);
  await clickWithCursor(card);
  await sleep(TIMELINE.repoConfirm);

  const start = await need(
    () => findByText("button", "Iniciar entrevista"),
    "não achei o botão de iniciar a entrevista",
  );
  await clickWithCursor(start);
}

/** O campo só esvazia quando o envio é confirmado; se travar, tenta de novo. */
async function answerWasSent(timeout: number): Promise<boolean> {
  const settled = await waitFor(
    () => {
      const live = findByLabel("textarea", "Sua resposta") as HTMLTextAreaElement | null;
      if (!live) return true; // a entrevista acabou e o campo saiu da tela
      return live.value === "" ? true : null;
    },
    { timeout },
  );

  return settled === true;
}

async function sendAnswer(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const send = await need(
      () => findByLabel("button", "Enviar resposta"),
      "não achei o botão de enviar a resposta",
    );

    await clickWithCursor(send);
    if (await answerWasSent(6_000)) return;
  }

  throw new DemoAborted("a resposta não foi enviada");
}

async function runInterview(runner: DemoRunner): Promise<void> {
  runner.onStep("interview");

  for (const { answer } of demoQuestions) {
    const textarea = await need(
      () => findByLabel("textarea", "Sua resposta") as HTMLTextAreaElement | null,
      "o chat da entrevista não abriu",
      25_000,
    );

    await sleep(TIMELINE.questionRead);
    await typeInto(textarea, answer, TIMELINE.answerTyping);
    await sendAnswer();
    await sleep(TIMELINE.answerSettle);
  }

  await sleep(TIMELINE.closingRead);

  const report = await need(
    () => findByText("a", "Ver meu relatório"),
    "a entrevista não chegou ao fim",
  );
  await clickWithCursor(report);
}

async function runReport(runner: DemoRunner): Promise<void> {
  runner.onStep("report");

  await need(
    () => findByText("h2", "Aderência do portfólio à vaga"),
    "o relatório não foi gerado",
  );

  hideCursor();
  await sleep(TIMELINE.reportRead);

  const scroller = outletScroller();
  await scrollThrough(scroller ?? window, TIMELINE.reportScroll);
}

export async function runDemoScript(runner: DemoRunner): Promise<void> {
  try {
    await runLanding(runner);
    await runDashboard(runner);
    await runVacancy(runner);
    await runRepositories(runner);
    await runInterview(runner);
    await runReport(runner);
    runner.onFinish();
  } catch (cause) {
    hideCursor();
    runner.onAbort(cause instanceof DemoAborted ? cause.message : "algo saiu do roteiro");
  }
}
