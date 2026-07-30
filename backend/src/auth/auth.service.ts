import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { GithubUser } from './types/github-user';
import { JwtPayload } from './types/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
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
}
