import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RepositoriesService } from './repos.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { FileSelectionError, RepoFileSelectorService } from './repo-file-selector.service';

const USER_ID = 'user-abc';
const OTHER_USER = 'user-xyz';
const VACANCY_ID = 'vaga-1';
const TOKEN = 'gho_token123';

const makeVacancy = (overrides: Record<string, unknown> = {}) => ({
  id: VACANCY_ID,
  userId: USER_ID,
  rawDescription: 'Vaga de backend Node.js',
  parsedStack: ['Node.js'],
  parsedSeniority: 'mid',
  parsedSkills: ['APIs REST'],
  parseConfidence: 1.0,
  parsedOutOfScope: false,
  parseStatus: 'done',
  parseFailureReason: null,
  createdAt: new Date(),
  ...overrides,
});

const jsonOk = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) });
const rawOk = (text: string) => ({ ok: true, text: () => Promise.resolve(text) });
const rawFail = () => ({ ok: false, text: () => Promise.resolve('Not Found') });
const httpErr = (status: number, headers: Record<string, string> = {}) => ({
  ok: false,
  status,
  headers: { get: (k: string) => headers[k] ?? null },
  text: () => Promise.resolve(''),
});

const tree = (...nodes: { path: string; type?: 'blob' | 'tree' }[]) =>
  jsonOk({ tree: nodes.map((n) => ({ path: n.path, type: n.type ?? 'blob' })) });

const httpBody = (err: unknown) => (err as HttpException).getResponse() as Record<string, unknown>;

describe('RepositoriesService', () => {
  let service: RepositoriesService;
  let users: { getGithubToken: jest.Mock };
  let prisma: { vacancy: Record<string, jest.Mock> };
  let fileSelector: { selectRelevantFiles: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    users = { getGithubToken: jest.fn().mockResolvedValue(TOKEN) };
    prisma = { vacancy: { findFirst: jest.fn().mockResolvedValue(makeVacancy()) } };
    fileSelector = { selectRelevantFiles: jest.fn() };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() };

    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoriesService,
        { provide: UsersService, useValue: users },
        { provide: PrismaService, useValue: prisma },
        { provide: RepoFileSelectorService, useValue: fileSelector },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(RepositoriesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listForUser (UC-07)', () => {
    const githubRepo = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      name: 'meu-projeto',
      owner: { login: 'candidato' },
      description: 'um projeto',
      language: 'TypeScript',
      private: true,
      ...overrides,
    });

    it('CT-07.1 recusa usuário sem token guardado, sem tocar no GitHub', async () => {
      users.getGithubToken.mockResolvedValue(null);

      await expect(service.listForUser(USER_ID)).rejects.toThrow(UnauthorizedException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('CT-07.2 normaliza a resposta do GitHub e marca repositório privado', async () => {
      fetchMock.mockResolvedValue(jsonOk([githubRepo()]));

      const result = await service.listForUser(USER_ID);

      expect(result).toEqual([
        {
          id: 1,
          owner: 'candidato',
          name: 'meu-projeto',
          description: 'um projeto',
          language: 'TypeScript',
          visibility: 'private',
        },
      ]);
    });

    it('CT-07.3 marca repositório público', async () => {
      fetchMock.mockResolvedValue(
        jsonOk([githubRepo({ private: false, description: null, language: null })]),
      );

      const [repo] = await service.listForUser(USER_ID);

      expect(repo.visibility).toBe('public');
      expect(repo.description).toBeNull();
      expect(repo.language).toBeNull();
    });

    it('CT-07.4 envia o token do usuário e o User-Agent da aplicação', async () => {
      fetchMock.mockResolvedValue(jsonOk([]));

      await service.listForUser(USER_ID);

      const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(url).toContain('https://api.github.com/user/repos');
      expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(init.headers['User-Agent']).toBe('trail-blazers-backend');
      expect(users.getGithubToken).toHaveBeenCalledWith(USER_ID);
    });

    it.each([403, 429])(
      'CT-07.5/07.6 traduz %s com cota zerada em limite_github_atingido',
      async (status) => {
        fetchMock.mockResolvedValue(httpErr(status, { 'x-ratelimit-remaining': '0' }));

        const err = await service.listForUser(USER_ID).catch((e: unknown) => e);

        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(httpBody(err).code).toBe('limite_github_atingido');
      },
    );

    it('CT-07.7 calcula retryAfterSeconds a partir do reset do GitHub', async () => {
      const reset = Math.floor(Date.now() / 1000) + 120;
      fetchMock.mockResolvedValue(
        httpErr(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
      );

      const err = await service.listForUser(USER_ID).catch((e: unknown) => e);

      expect(httpBody(err).retryAfterSeconds).toBeGreaterThan(115);
      expect(httpBody(err).retryAfterSeconds).toBeLessThanOrEqual(120);
    });

    it('CT-07.8 nunca devolve retryAfterSeconds negativo', async () => {
      const reset = Math.floor(Date.now() / 1000) - 500;
      fetchMock.mockResolvedValue(
        httpErr(429, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }),
      );

      const err = await service.listForUser(USER_ID).catch((e: unknown) => e);

      expect(httpBody(err).retryAfterSeconds).toBe(0);
    });

    it('CT-07.9 tolera ausência do header de reset', async () => {
      fetchMock.mockResolvedValue(httpErr(403, { 'x-ratelimit-remaining': '0' }));

      const err = await service.listForUser(USER_ID).catch((e: unknown) => e);

      expect(httpBody(err).retryAfterSeconds).toBeUndefined();
    });

    it('CT-07.10 trata 403 sem cota zerada como erro genérico do GitHub', async () => {
      fetchMock.mockResolvedValue(httpErr(403, { 'x-ratelimit-remaining': '42' }));

      const err = await service.listForUser(USER_ID).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(httpBody(err).code).toBe('erro_github');
    });

    it('CT-07.11 traduz 500 em 502 sem vazar o corpo da resposta do GitHub', async () => {
      fetchMock.mockResolvedValue(httpErr(500));

      const err = await service.listForUser(USER_ID).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(httpBody(err)).toEqual({
        statusCode: HttpStatus.BAD_GATEWAY,
        code: 'erro_github',
        message: 'Não foi possível buscar seus repositórios no GitHub agora.',
      });
    });
  });

  describe('analyzeRepositoryContent (UC-08)', () => {
    const armAnalysis = (paths: string[], contents: Record<string, string> = {}) => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('api.github.com')) {
          return Promise.resolve(tree(...paths.map((path) => ({ path }))));
        }
        const path = url.split('/HEAD/')[1];
        return Promise.resolve(rawOk(contents[path] ?? 'conteudo'));
      });
      fileSelector.selectRelevantFiles.mockResolvedValue(paths);
    };

    const analyze = () =>
      service.analyzeRepositoryContent(USER_ID, 'candidato', 'meu-projeto', VACANCY_ID);

    it('CT-08.1 exige uma vaga selecionada', async () => {
      const err = await service
        .analyzeRepositoryContent(USER_ID, 'candidato', 'meu-projeto', '')
        .catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(httpBody(err).code).toBe('vacancy_id_obrigatorio');
      expect(cache.get).not.toHaveBeenCalled();
    });

    it('CT-08.2 serve do cache sem tocar em banco, GitHub ou IA', async () => {
      const cached = { relevantFiles: [], omittedFiles: [], totalTokensEstimative: 0 };
      cache.get.mockResolvedValue(cached);

      await expect(analyze()).resolves.toBe(cached);
      expect(prisma.vacancy.findFirst).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(fileSelector.selectRelevantFiles).not.toHaveBeenCalled();
    });

    it('CT-08.3 separa o cache por usuário, repositório e vaga', async () => {
      armAnalysis(['src/app.ts']);

      await analyze();

      expect(cache.get).toHaveBeenCalledWith(
        `repo_analysis_${USER_ID}_candidato_meu-projeto_${VACANCY_ID}`,
      );
    });

    it('CT-08.4 🔒 recusa analisar com vaga de outro usuário', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(null);

      await expect(
        service.analyzeRepositoryContent(OTHER_USER, 'candidato', 'meu-projeto', VACANCY_ID),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.vacancy.findFirst).toHaveBeenCalledWith({
        where: { id: VACANCY_ID, userId: OTHER_USER },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('CT-08.5 recusa vaga ainda em análise com 409', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(makeVacancy({ parseStatus: 'pending' }));

      const err = await analyze().catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect(httpBody(err).code).toBe('vaga_ainda_analisando');
    });

    it('CT-08.6 recusa vaga com análise falha com 422', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(makeVacancy({ parseStatus: 'failed' }));

      const err = await analyze().catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(httpBody(err).code).toBe('vaga_sem_perfil');
    });

    it('CT-08.7 analisa normalmente vaga fora de escopo com parseStatus done', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(
        makeVacancy({ parseStatus: 'done', parsedOutOfScope: true }),
      );
      armAnalysis(['src/app.ts']);

      await expect(analyze()).resolves.toBeDefined();
    });

    it('CT-08.7b monta o perfil da vaga com defaults para colunas nulas', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(
        makeVacancy({
          parsedStack: null,
          parsedSeniority: null,
          parsedSkills: null,
          parsedOutOfScope: null,
          parseConfidence: 0.5,
        }),
      );
      armAnalysis(['src/app.ts']);

      await analyze();

      expect(fileSelector.selectRelevantFiles).toHaveBeenCalledWith(['src/app.ts'], {
        rawDescription: 'Vaga de backend Node.js',
        profile: {
          technologies: [],
          seniorityLevel: 'unknown',
          keyCompetencies: [],
          confidence: 'low',
          outOfScope: false,
        },
      });
    });

    it('CT-08.8 exige token do GitHub', async () => {
      users.getGithubToken.mockResolvedValue(null);

      await expect(analyze()).rejects.toThrow(UnauthorizedException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('CT-08.9 traduz falha ao buscar a árvore em 502', async () => {
      fetchMock.mockResolvedValue(httpErr(404));

      const err = await analyze().catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(httpBody(err).code).toBe('erro_github');
    });

    it('CT-08.10 descarta diretórios de dependências e artefatos', async () => {
      armAnalysis([]);
      fetchMock.mockImplementation((url: string) =>
        url.includes('api.github.com')
          ? Promise.resolve(
              tree(
                { path: 'node_modules/lib/index.js' },
                { path: 'dist/main.js' },
                { path: '.git/config' },
                { path: 'coverage/lcov.info' },
                { path: 'public/logo.js' },
                { path: 'src/app.ts' },
              ),
            )
          : Promise.resolve(rawOk('conteudo')),
      );
      fileSelector.selectRelevantFiles.mockResolvedValue(['src/app.ts']);

      await analyze();

      expect(fileSelector.selectRelevantFiles).toHaveBeenCalledWith(
        ['src/app.ts'],
        expect.anything(),
      );
    });

    it('CT-08.11 descarta binários e lockfiles', async () => {
      fetchMock.mockImplementation((url: string) =>
        url.includes('api.github.com')
          ? Promise.resolve(
              tree(
                { path: 'assets/logo.png' },
                { path: 'assets/icone.SVG' },
                { path: 'Gemfile.lock' },
                { path: 'package-lock.json' },
                { path: 'yarn.lock' },
                { path: 'src/app.ts' },
              ),
            )
          : Promise.resolve(rawOk('conteudo')),
      );
      fileSelector.selectRelevantFiles.mockResolvedValue(['src/app.ts']);

      await analyze();

      expect(fileSelector.selectRelevantFiles).toHaveBeenCalledWith(
        ['src/app.ts'],
        expect.anything(),
      );
    });

    it('CT-08.12/08.13 mantém arquivos sem extensão e ignora nós de diretório', async () => {
      fetchMock.mockImplementation((url: string) =>
        url.includes('api.github.com')
          ? Promise.resolve(
              tree({ path: 'src', type: 'tree' }, { path: 'Dockerfile' }, { path: 'src/app.ts' }),
            )
          : Promise.resolve(rawOk('conteudo')),
      );
      fileSelector.selectRelevantFiles.mockResolvedValue(['Dockerfile']);

      await analyze();

      expect(fileSelector.selectRelevantFiles).toHaveBeenCalledWith(
        ['Dockerfile', 'src/app.ts'],
        expect.anything(),
      );
    });

    it('CT-08.14 recusa repositório sem código analisável', async () => {
      fetchMock.mockResolvedValue(tree({ path: 'node_modules/lib/index.js' }));

      const err = await analyze().catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(httpBody(err).code).toBe('repo_vazio');
      expect(fileSelector.selectRelevantFiles).not.toHaveBeenCalled();
    });

    it.each([
      ['invalid_api_key', false],
      ['payment_required', false],
      ['timeout', true],
      ['rate_limited', true],
      ['ai_unavailable', true],
      ['invalid_response', true],
    ])('CT-08.15/08.16 %s vira 502 com retryable=%s', async (reason, retryable) => {
      armAnalysis(['src/app.ts']);
      fileSelector.selectRelevantFiles.mockRejectedValue(
        new FileSelectionError(
          reason as ConstructorParameters<typeof FileSelectionError>[0],
          'IA falhou',
        ),
      );

      const err = await analyze().catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(httpBody(err)).toEqual({ code: 'ia_indisponivel', message: 'IA falhou', retryable });
    });

    it('CT-08.17 repropaga erro que não é FileSelectionError', async () => {
      armAnalysis(['src/app.ts']);
      const erro = new Error('bug de programação');
      fileSelector.selectRelevantFiles.mockRejectedValue(erro);

      await expect(analyze()).rejects.toBe(erro);
    });

    it('CT-08.18 omite o arquivo que estoura o teto e mantém os anteriores', async () => {
      armAnalysis(['src/pequeno.ts', 'src/gigante.ts', 'src/outro.ts'], {
        'src/pequeno.ts': 'a'.repeat(100),
        'src/gigante.ts': 'b'.repeat(80_000),
        'src/outro.ts': 'c'.repeat(50),
      });

      const result = await analyze();

      expect(result.relevantFiles.map((f) => f.path)).toEqual(['src/pequeno.ts', 'src/outro.ts']);
      expect(result.omittedFiles).toEqual(['src/gigante.ts']);
    });

    it('CT-08.19 para de baixar arquivos depois de atingir o teto', async () => {
      armAnalysis(['src/enorme.ts', 'src/a.ts', 'src/b.ts'], {
        'src/enorme.ts': 'x'.repeat(80_000),
      });

      const result = await analyze();

      expect(result.omittedFiles).toEqual(['src/a.ts', 'src/b.ts']);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('CT-08.20 estima os tokens como um quarto dos caracteres armazenados', async () => {
      armAnalysis(['src/a.ts', 'src/b.ts'], {
        'src/a.ts': 'a'.repeat(10),
        'src/b.ts': 'b'.repeat(7),
      });

      const result = await analyze();

      expect(result.totalTokensEstimative).toBe(Math.ceil(17 / 4));
    });

    it('CT-08.21 guarda o resultado no cache', async () => {
      armAnalysis(['src/app.ts'], { 'src/app.ts': 'conteudo' });

      const result = await analyze();

      expect(cache.set).toHaveBeenCalledWith(
        `repo_analysis_${USER_ID}_candidato_meu-projeto_${VACANCY_ID}`,
        result,
      );
    });

    it('CT-08.21b baixa o conteúdo cru autenticado, no branch HEAD', async () => {
      armAnalysis(['src/app.ts']);

      await analyze();

      const [url, init] = fetchMock.mock.calls[1] as [string, { headers: Record<string, string> }];
      expect(url).toBe('https://raw.githubusercontent.com/candidato/meu-projeto/HEAD/src/app.ts');
      expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it('CT-08.22 omite o arquivo cujo download falhou em vez de tratá-lo como vazio', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('api.github.com')) {
          return Promise.resolve(tree({ path: 'src/ok.ts' }, { path: 'src/sumiu.ts' }));
        }
        return url.endsWith('sumiu.ts')
          ? Promise.resolve(rawFail())
          : Promise.resolve(rawOk('conteudo'));
      });
      fileSelector.selectRelevantFiles.mockResolvedValue(['src/ok.ts', 'src/sumiu.ts']);

      const result = await analyze();

      expect(result.relevantFiles.map((f) => f.path)).toEqual(['src/ok.ts']);
      expect(result.omittedFiles).toEqual(['src/sumiu.ts']);
    });
  });
});
