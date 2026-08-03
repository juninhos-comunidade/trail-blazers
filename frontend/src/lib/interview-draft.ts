/**
 * O que a pessoa montou nas etapas 1 e 2, guardado para as etapas seguintes.
 *
 * Fica no sessionStorage (e não em estado de rota) porque a pessoa pode
 * recarregar a página no meio do fluxo, e vive só na aba: cada aba monta uma
 * entrevista independente. Quando existir o endpoint de sessões, o id da
 * sessão substitui isso.
 */

import type { ParsedVacancyProfile } from "./vacancies-api";

const VACANCY_KEY = "interviewtrail.vacancy";
const REPOSITORY_KEY = "interviewtrail.repository";

export interface VacancyDraft {
  id: string;
  description: string;
  /**
   * Perfil extraído pela IA (RF-2.2). Nulo quando o parsing ainda não terminou
   * ou falhou — as etapas seguintes precisam funcionar sem ele.
   */
  profile?: ParsedVacancyProfile | null;
}

/**
 * Resumo do repositório analisado na etapa 2.
 *
 * Guarda só o suficiente para a entrevista se situar. O conteúdo completo dos
 * arquivos fica no cache do backend: jogá-lo no sessionStorage estouraria a
 * cota de ~5MB da aba num repositório de tamanho normal.
 */
export interface RepositoryDraft {
  owner: string;
  name: string;
  /** Linguagem predominante segundo o GitHub. */
  language: string | null;
  fileCount: number;
  omittedCount: number;
  /** Caminhos dos arquivos mais relevantes, na ordem que o backend priorizou. */
  topFiles: string[];
  /** Primeiras linhas do arquivo mais relevante, para a pergunta de código. */
  excerptPath?: string;
  excerpt?: string;
}

function read<T>(key: string, isValid: (value: unknown) => boolean): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? (parsed as T) : null;
  } catch {
    // Storage bloqueado ou conteúdo corrompido: a etapa pede os dados de novo.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // O fluxo continua nesta navegação; só não sobrevive a um reload.
  }
}

function remove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nada a fazer — quem chamou já seguiu em frente.
  }
}

export function readVacancyDraft(): VacancyDraft | null {
  return read<VacancyDraft>(VACANCY_KEY, (value) => {
    const draft = value as Partial<VacancyDraft> | null;
    return (
      typeof draft?.id === "string" && typeof draft.description === "string"
    );
  });
}

export function writeVacancyDraft(draft: VacancyDraft): void {
  write(VACANCY_KEY, draft);
}

/** Trocar de vaga invalida o repositório escolhido para a vaga anterior. */
export function clearVacancyDraft(): void {
  remove(VACANCY_KEY);
  remove(REPOSITORY_KEY);
}

export function readRepositoryDraft(): RepositoryDraft | null {
  return read<RepositoryDraft>(REPOSITORY_KEY, (value) => {
    const draft = value as Partial<RepositoryDraft> | null;
    return typeof draft?.owner === "string" && typeof draft.name === "string";
  });
}

export function writeRepositoryDraft(draft: RepositoryDraft): void {
  write(REPOSITORY_KEY, draft);
}

export function clearRepositoryDraft(): void {
  remove(REPOSITORY_KEY);
}
