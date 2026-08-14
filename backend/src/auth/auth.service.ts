import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { GithubUser } from './types/github-user';
import { JwtPayload } from './types/jwt-payload';

const LOGIN_CODE_TTL_MS = 60_000;
const LOGIN_CODE_CACHE_PREFIX = 'login_code_';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async loginWithGithub(githubUser: GithubUser) {
    const user = await this.usersService.upsertFromGithub(githubUser);

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  /**
   * O token nunca vai na URL do redirect (fica no histórico do navegador,
   * em logs de servidor e no header Referer). Em vez disso, o front recebe
   * só este código de uso único e o troca pelo token via POST.
   */
  async createLoginCode(accessToken: string): Promise<string> {
    const code = randomBytes(32).toString('hex');

    await this.cacheManager.set(
      `${LOGIN_CODE_CACHE_PREFIX}${code}`,
      accessToken,
      LOGIN_CODE_TTL_MS,
    );

    return code;
  }

  async exchangeLoginCode(code: string): Promise<string> {
    const cacheKey = `${LOGIN_CODE_CACHE_PREFIX}${code}`;
    const accessToken = await this.cacheManager.get<string>(cacheKey);

    if (!accessToken) {
      throw new UnauthorizedException('Código de login inválido ou expirado.');
    }

    await this.cacheManager.del(cacheKey);

    return accessToken;
  }
}
