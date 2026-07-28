import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '@users/users.service';
import { RepositorySummary } from '@repos/types/repos-summary';

interface GithubRepoResponse {
  id: number;
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  private: boolean;
}

const GITHUB_REPOS_URL =
  'https://api.github.com/user/repos?per_page=100&sort=full_name&affiliation=owner';

@Injectable()
export class RepositoriesService {
  constructor(private readonly usersService: UsersService) {}

  async listForUser(userId: string): Promise<RepositorySummary[]> {
    const token = await this.usersService.getGithubToken(userId);

    if (!token) {
      throw new UnauthorizedException('Token do GitHub não encontrado. Faça login novamente.');
    }

    const response = await fetch(GITHUB_REPOS_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'trail-blazers-backend',
      },
    });

    if (!response.ok) {
      throw this.mapGithubError(response);
    }

    const repos = (await response.json()) as GithubRepoResponse[];

    return repos.map((repo) => ({
      id: repo.id,
      owner: repo.owner.login,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      visibility: repo.private ? 'private' : 'public',
    }));
  }

  private mapGithubError(response: Response): HttpException {
    const isRateLimited =
      (response.status === 403 || response.status === 429) &&
      response.headers.get('x-ratelimit-remaining') === '0';

    if (isRateLimited) {
      const resetHeader = response.headers.get('x-ratelimit-reset');
      const retryAfterSeconds = resetHeader
        ? Math.max(0, Number(resetHeader) - Math.floor(Date.now() / 1000))
        : undefined;

      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: 'limite_github_atingido',
          message: 'O GitHub limitou nossas requisições por agora. Tente novamente em instantes.',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        code: 'erro_github',
        message: 'Não foi possível buscar seus repositórios no GitHub agora.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
