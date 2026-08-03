import { readToken } from "@auth/token-storage";
import { API_URL } from "./env";

/**
 * Limites da descrição, iguais aos do `CreateVacancySchema` no backend. Ficam
 * aqui para a tela avisar antes de gastar uma requisição — a validação que
 * vale continua sendo a do servidor.
 */
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 10_000;

/** Perfil extraído da vaga pela IA (RF-2.2). */
export interface ParsedVacancyProfile {
  technologies: string[];
  seniorityLevel: "junior" | "mid" | "senior" | "lead" | "unknown";
  keyCompetencies: string[];
  confidence: "high" | "low";
  /** `true` quando a vaga não é da área de tecnologia. */
  outOfScope: boolean;
}

/** Vaga como o backend devolve no POST /vacancies (tabela `vacancies`). */
export interface Vacancy {
  id: string;
  userId: string;
  rawDescription: string;
  /**
   * O parsing roda em segundo plano: o POST responde com `parsingCompleted`
   * false e `parsedProfile` nulo. Faça polling em `GET /vacancies/:id` até
   * `parsingCompleted` virar true.
   */
  parsedProfile: ParsedVacancyProfile | null;
  parsingCompleted: boolean;
  createdAt: string;
}

/**
 * Falha ao salvar a vaga, já traduzida para a tela: `detail` diz o que
 * aconteceu e `hint` sugere o que fazer. Mesmo contrato do `RepositoriesError`.
 */
export class VacancyError extends Error {
  readonly detail: string;
  readonly hint?: string;
  /** Tentar de novo só ajuda em falhas transitórias. */
  readonly retryable: boolean;

  constructor(detail: string, options: { hint?: string; retryable?: boolean } = {}) {
    super(detail);
    this.name = "VacancyError";
    this.detail = detail;
    this.hint = options.hint;
    this.retryable = options.retryable ?? true;
  }
}

/** O ValidationPipe global responde com `message` em array; as outras, string. */
type ErrorBody = { message?: string | string[] } | null;

function firstMessage(body: ErrorBody): string | undefined {
  if (Array.isArray(body?.message)) return body.message[0];
  return body?.message;
}

function mapErrorResponse(status: number, body: ErrorBody): VacancyError {
  if (status === 400) {
    return new VacancyError(
      firstMessage(body) ?? "A descrição da vaga não foi aceita.",
      { hint: "Ajuste o texto e tente de novo.", retryable: false },
    );
  }

  if (status === 401 || status === 403) {
    return new VacancyError("Sua sessão não é mais válida.", {
      hint: "Saia e entre de novo para continuar.",
      retryable: false,
    });
  }

  if (status >= 500) {
    return new VacancyError(
      firstMessage(body) ?? "O servidor não conseguiu salvar a vaga.",
      { hint: "Costuma ser temporário." },
    );
  }

  return new VacancyError(
    firstMessage(body) ?? `Não conseguimos salvar a vaga (código ${status}).`,
  );
}

/**
 * Confere o contrato antes de entregar a vaga para a tela.
 *
 * Sem isto, um campo ausente vira `undefined` e só explode lá adiante, ao
 * renderizar — foi o que aconteceu quando o servidor rodava uma versão que
 * ainda chamava `rawDescription` de `description`: a tela ficava em branco,
 * sem nenhuma pista do motivo. Falhar aqui troca a tela branca por um erro
 * que diz o que está errado.
 */
function ensureVacancy(payload: unknown): Vacancy {
  const vacancy = payload as Partial<Vacancy> | null;

  if (
    typeof vacancy?.id !== "string" ||
    typeof vacancy.rawDescription !== "string"
  ) {
    throw new VacancyError(
      "O servidor respondeu num formato que não conseguimos ler.",
      {
        hint: "Se o backend acabou de ser atualizado, reinicie-o para carregar a versão nova.",
        retryable: false,
      },
    );
  }

  return vacancy as Vacancy;
}

/** RF-2.1: grava a descrição da vaga do usuário autenticado. */
export async function createVacancy(description: string): Promise<Vacancy> {
  const token = readToken();

  let response: Response;

  try {
    response = await fetch(`${API_URL}/vacancies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ description }),
    });
  } catch {
    // fetch só rejeita quando a requisição nem chegou a ser respondida.
    throw new VacancyError(
      "Não conseguimos falar com o servidor do InterviewTrail.",
      { hint: "Verifique sua conexão e tente de novo." },
    );
  }

  if (!response.ok) {
    throw mapErrorResponse(
      response.status,
      (await response.json().catch(() => null)) as ErrorBody,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new VacancyError(
      "O servidor respondeu num formato que não conseguimos ler.",
    );
  }

  return ensureVacancy(payload);
}

/** RF-2.2: lê uma vaga já salva, inclusive o perfil extraído pela IA. */
export async function getVacancy(id: string): Promise<Vacancy> {
  const token = readToken();

  let response: Response;

  try {
    response = await fetch(`${API_URL}/vacancies/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new VacancyError(
      "Não conseguimos falar com o servidor do InterviewTrail.",
      { hint: "Verifique sua conexão e tente de novo." },
    );
  }

  if (!response.ok) {
    throw mapErrorResponse(
      response.status,
      (await response.json().catch(() => null)) as ErrorBody,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new VacancyError(
      "O servidor respondeu num formato que não conseguimos ler.",
    );
  }

  return ensureVacancy(payload);
}

/** Intervalo entre consultas e teto de espera do parsing em segundo plano. */
const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 45_000;

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Acompanha o parsing que o backend dispara em segundo plano no POST.
 *
 * Devolve a vaga assim que `parsingCompleted` vira true. Se o teto de espera
 * estourar, devolve a última leitura ainda incompleta em vez de lançar: a
 * análise é um enfeite do fluxo, e travar a pessoa na etapa 1 porque a IA
 * demorou seria pior do que seguir sem o perfil.
 */
export async function waitForVacancyParsing(
  id: string,
  signal?: AbortSignal,
): Promise<Vacancy> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let latest = await getVacancy(id);

  while (!latest.parsingCompleted && Date.now() < deadline) {
    if (signal?.aborted) return latest;

    await wait(POLL_INTERVAL_MS, signal);
    if (signal?.aborted) return latest;

    latest = await getVacancy(id);
  }

  return latest;
}
