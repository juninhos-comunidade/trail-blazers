import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GithubUser } from './types/github-user';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async loginWithGithub(githubUser: GithubUser) {
    //TODO: persistir/buscar o usuário no banco (model User) e usar o id interno como `sub`

    const payload = {
      sub: githubUser.githubId,
      username: githubUser.username,
      email: githubUser.email,
      avatarUrl: githubUser.avatarUrl,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }
}
