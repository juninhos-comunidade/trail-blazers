import { UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { GithubUser } from './types/github-user';

describe('AuthService', () => {
  let service: AuthService;

  const jwtMock = { signAsync: jest.fn() };
  const usersMock = { upsertFromGithub: jest.fn() };
  const cacheMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  const githubUser: GithubUser = {
    githubId: '123',
    username: 'john',
    email: 'john@example.com',
    avatarUrl: 'https://avatar',
    accessToken: 'gho_token',
  };

  const persistedUser = {
    id: 'uuid-interno',
    githubId: '123',
    username: 'john',
    email: 'john@example.com',
    avatarUrl: 'https://avatar',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtMock.signAsync.mockResolvedValue('jwt-assinado');
    usersMock.upsertFromGithub.mockResolvedValue(persistedUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtMock },
        { provide: UsersService, useValue: usersMock },
        { provide: CACHE_MANAGER, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('usa o id interno do usuário como `sub`, e não o githubId', async () => {
    await service.loginWithGithub(githubUser);

    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'uuid-interno' }),
    );

    const [payload] = jwtMock.signAsync.mock.calls[0] as [Record<string, unknown>];
    expect(payload.sub).not.toBe(githubUser.githubId);
  });

  it('persiste o usuário antes de assinar e devolve o token', async () => {
    const result = await service.loginWithGithub(githubUser);

    expect(usersMock.upsertFromGithub).toHaveBeenCalledWith(githubUser);
    expect(result).toEqual({ accessToken: 'jwt-assinado' });
  });

  it('monta o payload com os dados persistidos', async () => {
    await service.loginWithGithub(githubUser);

    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'uuid-interno',
      username: 'john',
      email: 'john@example.com',
      avatarUrl: 'https://avatar',
    });
  });

  it('converte email/avatarUrl nulos em undefined no payload', async () => {
    usersMock.upsertFromGithub.mockResolvedValue({
      ...persistedUser,
      email: null,
      avatarUrl: null,
    });

    await service.loginWithGithub(githubUser);

    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'uuid-interno',
      username: 'john',
      email: undefined,
      avatarUrl: undefined,
    });
  });

  it('propaga falha da persistência sem emitir token', async () => {
    usersMock.upsertFromGithub.mockRejectedValue(new Error('banco fora do ar'));

    await expect(service.loginWithGithub(githubUser)).rejects.toThrow('banco fora do ar');
    expect(jwtMock.signAsync).not.toHaveBeenCalled();
  });

  describe('createLoginCode', () => {
    it('gera um código e guarda o token no cache com TTL curto', async () => {
      const code = await service.createLoginCode('jwt-assinado');

      expect(code).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
      expect(cacheMock.set).toHaveBeenCalledWith(`login_code_${code}`, 'jwt-assinado', 60_000);
    });

    it('gera códigos diferentes a cada chamada', async () => {
      const first = await service.createLoginCode('jwt-assinado');
      const second = await service.createLoginCode('jwt-assinado');

      expect(first).not.toBe(second);
    });
  });

  describe('exchangeLoginCode', () => {
    it('devolve o token e apaga o código do cache (uso único)', async () => {
      cacheMock.get.mockResolvedValue('jwt-assinado');

      const accessToken = await service.exchangeLoginCode('codigo-valido');

      expect(accessToken).toBe('jwt-assinado');
      expect(cacheMock.get).toHaveBeenCalledWith('login_code_codigo-valido');
      expect(cacheMock.del).toHaveBeenCalledWith('login_code_codigo-valido');
    });

    it('lança UnauthorizedException para código inexistente ou expirado', async () => {
      cacheMock.get.mockResolvedValue(undefined);

      await expect(service.exchangeLoginCode('codigo-invalido')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(cacheMock.del).not.toHaveBeenCalled();
    });
  });
});
