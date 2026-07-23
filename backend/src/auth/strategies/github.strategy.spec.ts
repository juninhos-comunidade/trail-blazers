import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Profile } from 'passport-github2';
import { GithubUser } from '../types/github-user';
import { GithubStrategy } from './github.strategy';

describe('GithubStrategy', () => {
  let strategy: GithubStrategy;

  const env: Record<string, string> = {
    GITHUB_CLIENT_ID: 'client-id',
    GITHUB_CLIENT_SECRET: 'client-secret',
    GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
  };

  const configMock = { getOrThrow: jest.fn((key: string) => env[key]) };

  // só os campos que a strategy lê; o Profile real do passport é bem maior
  const buildProfile = (overrides: Partial<Profile> = {}) =>
    ({
      id: '123',
      username: 'john',
      emails: [{ value: 'john@example.com' }],
      photos: [{ value: 'https://avatar' }],
      ...overrides,
    }) as Profile;

  // captura o resultado do callback `done` da strategy
  const runValidate = async (profile: Profile) => {
    let result: GithubUser | undefined;
    await strategy.validate('gho_token', 'refresh', profile, (_err, user) => {
      result = user;
    });
    return result;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [GithubStrategy, { provide: ConfigService, useValue: configMock }],
    }).compile();

    strategy = module.get<GithubStrategy>(GithubStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('lê as credenciais do OAuth App a partir do ConfigService', () => {
    expect(configMock.getOrThrow).toHaveBeenCalledWith('GITHUB_CLIENT_ID');
    expect(configMock.getOrThrow).toHaveBeenCalledWith('GITHUB_CLIENT_SECRET');
    expect(configMock.getOrThrow).toHaveBeenCalledWith('GITHUB_CALLBACK_URL');
  });

  // CT-01.1
  it('mapeia o profile do GitHub para GithubUser', async () => {
    await expect(runValidate(buildProfile())).resolves.toEqual({
      githubId: '123',
      username: 'john',
      email: 'john@example.com',
      avatarUrl: 'https://avatar',
      accessToken: 'gho_token',
    });
  });

  it('usa apenas o primeiro email e a primeira foto', async () => {
    const profile = buildProfile({
      emails: [{ value: 'principal@example.com' }, { value: 'secundario@example.com' }],
      photos: [{ value: 'https://primeira' }, { value: 'https://segunda' }],
    });

    const user = await runValidate(profile);

    expect(user?.email).toBe('principal@example.com');
    expect(user?.avatarUrl).toBe('https://primeira');
  });

  // CT-01.2 — conta do GitHub com email privado e/ou sem avatar
  it('devolve undefined quando não há email nem foto', async () => {
    const user = await runValidate(buildProfile({ emails: undefined, photos: undefined }));

    expect(user?.email).toBeUndefined();
    expect(user?.avatarUrl).toBeUndefined();
    expect(user?.githubId).toBe('123');
  });

  it('devolve undefined quando as listas de email e foto vêm vazias', async () => {
    const user = await runValidate(buildProfile({ emails: [], photos: [] }));

    expect(user?.email).toBeUndefined();
    expect(user?.avatarUrl).toBeUndefined();
  });

  // CT-01.3
  it('usa string vazia quando o profile não tem username', async () => {
    const user = await runValidate(buildProfile({ username: undefined }));

    expect(user?.username).toBe('');
  });

  it('chama o callback sem erro', async () => {
    const done = jest.fn();

    await strategy.validate('gho_token', 'refresh', buildProfile(), done);

    expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ githubId: '123' }));
  });
});
