import { readToken } from '@auth/token-storage';
import { API_URL } from './env';

export interface RepoSummary {
  id: number;
  owner: string;
  name: string;
  language: string | null;
  visibility: "public" | "private";
}

export class GithubRateLimitError extends Error {
  retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'GithubRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function fetchRepos(): Promise<RepoSummary[]> {
  const token = readToken();

  const response = await fetch(`${API_URL}/repositories`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string; code?: string; retryAfterSeconds?: number }
      | null;

    if (response.status === 429 && body?.code === "limite_github_atingido") {
      throw new GithubRateLimitError(
        body.message ?? "Limite de requisições do GitHub atingido.",
        body.retryAfterSeconds,
      );
    }

    throw new Error(body?.message ?? "Não foi possível carregar seus repositórios.");
  }

  return response.json() as Promise<RepoSummary[]>;
}
