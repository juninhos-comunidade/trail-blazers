import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { RepositoriesService, type ProcessedRepository } from '../repos/repos.service';
import { QuestionGenerationError, QuestionGeneratorService } from './question-generator.service';
import { ReportGenerationError, ReportGeneratorService } from './report-generator.service';
import type { AiQuestion } from './schemas/interview.schema';

const USER_ID = 'user-abc';
const OTHER_USER = 'user-xyz';
const SESSION_ID = 'sessao-1';
const VACANCY_ID = 'vaga-1';

const CREATE_DTO = {
  vacancyId: VACANCY_ID,
  owner: 'candidato',
  repo: 'meu-projeto',
  questionCount: 8,
};

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

const makeAnalysis = (overrides: Partial<ProcessedRepository> = {}): ProcessedRepository => ({
  relevantFiles: [
    { path: 'src/app.ts', content: 'a'.repeat(40) },
    { path: 'src/main.ts', content: 'b'.repeat(20) },
  ],
  omittedFiles: ['src/gigante.ts'],
  totalTokensEstimative: 15,
  ...overrides,
});

const makeAiQuestions = (): AiQuestion[] => [
  { type: 'logic', content: 'Pergunta de aquecimento sobre lógica.' },
  {
    type: 'code_analysis',
    content: 'O que este trecho faz?',
    codeFile: 'src/app.ts',
    codeExcerpt: 'const a = 1;',
  },
];

const makeQuestionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'pergunta-1',
  sessionId: SESSION_ID,
  sessionRepoId: 'repo-1',
  type: 'logic',
  orderIndex: 1,
  content: 'Pergunta de aquecimento sobre lógica.',
  metadata: null,
  answer: null,
  ...overrides,
});

const makeSessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  userId: USER_ID,
  vacancyId: VACANCY_ID,
  status: 'in_progress',
  totalInputTokens: 0,
  totalOutputTokens: 0,
  createdAt: new Date(),
  completedAt: null,
  ...overrides,
});

const makeSessionRepoRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'repo-1',
  sessionId: SESSION_ID,
  repoFullName: 'candidato/meu-projeto',
  repoUrl: 'https://github.com/candidato/meu-projeto',
  primaryLanguage: 'TypeScript',
  selectedFilesSnapshot: ['src/app.ts', 'src/main.ts'],
  ...overrides,
});

const makeAiReport = (overrides: Record<string, unknown> = {}) => ({
  overallScore: 72,
  adherenceScore: 40,
  adherenceNotes: [{ title: 'Stack', text: 'Bate parcialmente.' }],
  dimensionScores: [{ label: 'Lógica', score: 80 }],
  strengths: [{ title: 'Clareza', text: 'Explicou bem.' }],
  gaps: [{ title: 'Testes', text: 'Não mencionou testes.' }],
  recommendations: [{ title: 'Estudar', text: 'Aprofundar em Node.' }],
  ...overrides,
});

const makeReportRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'relatorio-1',
  sessionId: SESSION_ID,
  ...makeAiReport(),
  createdAt: new Date(),
  ...overrides,
});

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
  });

const httpBody = (err: unknown) => (err as HttpException).getResponse() as Record<string, unknown>;

const like = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape) as unknown;

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: {
    vacancy: Record<string, jest.Mock>;
    session: Record<string, jest.Mock>;
    sessionRepo: Record<string, jest.Mock>;
    question: Record<string, jest.Mock>;
    answer: Record<string, jest.Mock>;
    report: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let repositories: { analyzeRepositoryContent: jest.Mock };
  let questionGenerator: { generate: jest.Mock };
  let reportGenerator: { generate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      vacancy: { findFirst: jest.fn() },
      session: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sessionRepo: { create: jest.fn() },
      question: { create: jest.fn() },
      answer: { create: jest.fn() },
      report: { create: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));

    repositories = { analyzeRepositoryContent: jest.fn() };
    questionGenerator = { generate: jest.fn() };
    reportGenerator = { generate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RepositoriesService, useValue: repositories },
        { provide: QuestionGeneratorService, useValue: questionGenerator },
        { provide: ReportGeneratorService, useValue: reportGenerator },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  const armCreate = (questions: AiQuestion[] = makeAiQuestions()) => {
    prisma.vacancy.findFirst.mockResolvedValue(makeVacancy());
    repositories.analyzeRepositoryContent.mockResolvedValue(makeAnalysis());
    questionGenerator.generate.mockResolvedValue(questions);
    prisma.session.create.mockResolvedValue(makeSessionRow());
    prisma.sessionRepo.create.mockResolvedValue(makeSessionRepoRow());
    prisma.question.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeQuestionRow({ id: `pergunta-${String(data.orderIndex)}`, ...data })),
    );
  };

  describe('create (UC-12)', () => {
    it('CT-12.1 🔒 recusa vaga de outro usuário', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(null);

      await expect(service.create(OTHER_USER, CREATE_DTO)).rejects.toThrow(NotFoundException);
      expect(prisma.vacancy.findFirst).toHaveBeenCalledWith({
        where: { id: VACANCY_ID, userId: OTHER_USER },
      });
      expect(repositories.analyzeRepositoryContent).not.toHaveBeenCalled();
    });

    it('CT-12.2 recusa vaga ainda em análise com 409', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(makeVacancy({ parseStatus: 'pending' }));

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect(httpBody(err).code).toBe('vaga_ainda_analisando');
    });

    it('CT-12.3 recusa vaga com análise falha com 422', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(makeVacancy({ parseStatus: 'failed' }));

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(httpBody(err).code).toBe('vaga_sem_perfil');
    });

    it('CT-12.4 cria a sessão normalmente para vaga fora de escopo com parseStatus done', async () => {
      armCreate();
      prisma.vacancy.findFirst.mockResolvedValue(
        makeVacancy({ parseStatus: 'done', parsedOutOfScope: true }),
      );

      const result = await service.create(USER_ID, CREATE_DTO);

      expect(result.status).toBe('in_progress');
    });

    it('CT-12.5 cria a sessão com status in_progress', async () => {
      armCreate();

      const result = await service.create(USER_ID, CREATE_DTO);

      expect(result.status).toBe('in_progress');
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: like({
          userId: USER_ID,
          vacancyId: VACANCY_ID,
          status: 'in_progress',
        }),
      });
    });

    it('CT-12.6 grava o snapshot do repositório escolhido', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);

      expect(prisma.sessionRepo.create).toHaveBeenCalledWith({
        data: {
          sessionId: SESSION_ID,
          repoFullName: 'candidato/meu-projeto',
          repoUrl: 'https://github.com/candidato/meu-projeto',
          selectedFilesSnapshot: ['src/app.ts', 'src/main.ts'],
        },
      });
    });

    it('CT-12.7 numera as perguntas a partir de 1 na ordem devolvida pela IA', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);

      const criadas = prisma.question.create.mock.calls.map(
        ([arg]: [{ data: Record<string, unknown> }]) => arg.data,
      );
      expect(criadas.map((d) => d.orderIndex)).toEqual([1, 2]);
      expect(criadas.map((d) => d.type)).toEqual(['logic', 'code_analysis']);
    });

    it('CT-12.8 grava metadata para pergunta com trecho de código', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);

      const codeQuestion = prisma.question.create.mock.calls
        .map(([arg]: [{ data: Record<string, unknown> }]) => arg.data)
        .find((d) => d.type === 'code_analysis');
      expect(codeQuestion?.metadata).toEqual({
        codeFile: 'src/app.ts',
        codeExcerpt: 'const a = 1;',
      });
    });

    it('CT-12.9 grava metadata indefinida para pergunta sem código', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);

      const plain = prisma.question.create.mock.calls
        .map(([arg]: [{ data: Record<string, unknown> }]) => arg.data)
        .find((d) => d.type === 'logic');
      expect(plain?.metadata).toBeUndefined();
    });

    it('CT-12.10 estima tokens de entrada com descrição + conteúdo dos arquivos', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);

      const [[{ data }]] = prisma.session.create.mock.calls as [
        [{ data: { totalInputTokens: number } }],
      ];
      expect(data.totalInputTokens).toBe(21);
    });

    it('CT-12.11 estima tokens de saída pelo conteúdo das perguntas', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);

      const chars = makeAiQuestions().reduce((sum, q) => sum + q.content.length, 0);
      const [[{ data }]] = prisma.session.create.mock.calls as [
        [{ data: { totalOutputTokens: number } }],
      ];
      expect(data.totalOutputTokens).toBe(Math.ceil(chars / 4));
    });

    it('CT-12.12 devolve no máximo 5 arquivos em repoAnalysis.topFiles', async () => {
      armCreate();
      repositories.analyzeRepositoryContent.mockResolvedValue(
        makeAnalysis({
          relevantFiles: Array.from({ length: 7 }, (_, i) => ({
            path: `src/f${String(i)}.ts`,
            content: 'x',
          })),
        }),
      );

      const result = await service.create(USER_ID, CREATE_DTO);

      expect(result.repoAnalysis).toEqual({
        fileCount: 7,
        omittedCount: 1,
        topFiles: ['src/f0.ts', 'src/f1.ts', 'src/f2.ts', 'src/f3.ts', 'src/f4.ts'],
      });
    });

    it('CT-12.13 cria sessão, repo e perguntas dentro da mesma transação', async () => {
      armCreate();
      const dentroDaTransacao: string[] = [];
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        dentroDaTransacao.push('inicio');
        const out = await cb(prisma);
        dentroDaTransacao.push('fim');
        return out;
      });

      await service.create(USER_ID, CREATE_DTO);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(dentroDaTransacao).toEqual(['inicio', 'fim']);
      expect(prisma.session.create.mock.invocationCallOrder[0]).toBeGreaterThan(
        prisma.$transaction.mock.invocationCallOrder[0],
      );
    });

    it('CT-12.14 converte falha de IA recuperável em 502 retryable', async () => {
      armCreate();
      questionGenerator.generate.mockRejectedValue(
        new QuestionGenerationError('rate_limited', 'muitas chamadas'),
      );

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(httpBody(err)).toEqual({
        code: 'ia_indisponivel_perguntas',
        message: 'muitas chamadas',
        retryable: true,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('CT-12.15 marca payment_required como não recuperável', async () => {
      armCreate();
      questionGenerator.generate.mockRejectedValue(
        new QuestionGenerationError('payment_required', 'sem créditos'),
      );

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect(httpBody(err).retryable).toBe(false);
    });

    it('CT-12.15b marca invalid_api_key como não recuperável', async () => {
      armCreate();
      questionGenerator.generate.mockRejectedValue(
        new QuestionGenerationError('invalid_api_key', 'chave inválida'),
      );

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect(httpBody(err).retryable).toBe(false);
    });

    it('CT-12.16 usa ai_unavailable para erro sem reason conhecido', async () => {
      armCreate();
      questionGenerator.generate.mockRejectedValue(new Error('boom'));

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect(httpBody(err)).toEqual({
        code: 'ia_indisponivel_perguntas',
        message: 'boom',
        retryable: true,
      });
    });

    it('CT-12.17 deixa o erro da análise do repositório subir intacto', async () => {
      prisma.vacancy.findFirst.mockResolvedValue(makeVacancy());
      const original = new HttpException({ code: 'repo_vazio' }, HttpStatus.BAD_REQUEST);
      repositories.analyzeRepositoryContent.mockRejectedValue(original);

      const err = await service.create(USER_ID, CREATE_DTO).catch((e: unknown) => e);

      expect(err).toBe(original);
      expect(questionGenerator.generate).not.toHaveBeenCalled();
    });

    it('CT-12.18 traduz parseConfidence em confidence high/low para a IA', async () => {
      armCreate();

      await service.create(USER_ID, CREATE_DTO);
      expect(questionGenerator.generate).toHaveBeenLastCalledWith(
        like({
          profile: like({ confidence: 'high' }),
          count: 8,
        }),
      );

      prisma.vacancy.findFirst.mockResolvedValue(makeVacancy({ parseConfidence: 0.5 }));
      await service.create(USER_ID, CREATE_DTO);
      expect(questionGenerator.generate).toHaveBeenLastCalledWith(
        like({ profile: like({ confidence: 'low' }) }),
      );
    });

    it('CT-12.18b usa defaults quando as colunas do parsing estão nulas', async () => {
      armCreate();
      prisma.vacancy.findFirst.mockResolvedValue(
        makeVacancy({
          parsedStack: null,
          parsedSeniority: null,
          parsedSkills: null,
          parsedOutOfScope: null,
        }),
      );

      await service.create(USER_ID, CREATE_DTO);

      expect(questionGenerator.generate).toHaveBeenLastCalledWith(
        like({
          profile: {
            technologies: [],
            seniorityLevel: 'unknown',
            keyCompetencies: [],
            confidence: 'high',
            outOfScope: false,
          },
        }),
      );
    });
  });

  describe('submitAnswer (UC-13)', () => {
    const armSession = (questions: Record<string, unknown>[], status = 'in_progress') => {
      prisma.session.findFirst.mockResolvedValue(makeSessionRow({ status, questions }));
    };

    it('CT-13.1 🔒 recusa sessão de outro usuário', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(
        service.submitAnswer(OTHER_USER, SESSION_ID, { questionId: 'p1', content: 'oi' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        like({ where: { id: SESSION_ID, userId: OTHER_USER } }),
      );
      expect(prisma.answer.create).not.toHaveBeenCalled();
    });

    it('CT-13.2 recusa pergunta que não pertence à sessão', async () => {
      armSession([makeQuestionRow({ id: 'p1' })]);

      await expect(
        service.submitAnswer(USER_ID, SESSION_ID, { questionId: 'p-de-outra', content: 'oi' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.answer.create).not.toHaveBeenCalled();
    });

    it('CT-13.3 resposta parcial não muda o status da sessão', async () => {
      armSession([makeQuestionRow({ id: 'p1' }), makeQuestionRow({ id: 'p2' })]);
      prisma.answer.create.mockResolvedValue({ id: 'r1', content: 'minha resposta' });

      const result = await service.submitAnswer(USER_ID, SESSION_ID, {
        questionId: 'p1',
        content: 'minha resposta',
      });

      expect(result).toEqual({
        answer: { id: 'r1', questionId: 'p1', content: 'minha resposta' },
        allAnswered: false,
      });
      expect(prisma.session.update).not.toHaveBeenCalled();
    });

    it('CT-13.4 última resposta move a sessão para evaluating', async () => {
      armSession([
        makeQuestionRow({ id: 'p1', answer: { id: 'r0', content: 'já respondi' } }),
        makeQuestionRow({ id: 'p2' }),
      ]);
      prisma.answer.create.mockResolvedValue({ id: 'r1', content: 'última' });

      const result = await service.submitAnswer(USER_ID, SESSION_ID, {
        questionId: 'p2',
        content: 'última',
      });

      expect(result.allAnswered).toBe(true);
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { status: 'evaluating' },
      });
    });

    it('CT-13.5 reenvio da mesma pergunta devolve a resposta existente sem criar outra', async () => {
      armSession([
        makeQuestionRow({ id: 'p1', answer: { id: 'r0', content: 'resposta original' } }),
        makeQuestionRow({ id: 'p2' }),
      ]);

      const result = await service.submitAnswer(USER_ID, SESSION_ID, {
        questionId: 'p1',
        content: 'texto novo que deve ser ignorado',
      });

      expect(result.answer).toEqual({
        id: 'r0',
        questionId: 'p1',
        content: 'resposta original',
      });
      expect(result.allAnswered).toBe(false);
      expect(prisma.answer.create).not.toHaveBeenCalled();
    });

    it('CT-13.6 reenvio da última pergunta ainda reporta allAnswered', async () => {
      armSession([
        makeQuestionRow({ id: 'p1', answer: { id: 'r0', content: 'a' } }),
        makeQuestionRow({ id: 'p2', answer: { id: 'r1', content: 'b' } }),
      ]);

      const result = await service.submitAnswer(USER_ID, SESSION_ID, {
        questionId: 'p2',
        content: 'reenvio',
      });

      expect(result.allAnswered).toBe(true);
      expect(prisma.answer.create).not.toHaveBeenCalled();
    });

    it('CT-13.7 não reescreve o status de uma sessão que já saiu de in_progress', async () => {
      armSession([makeQuestionRow({ id: 'p1' })], 'evaluating');
      prisma.answer.create.mockResolvedValue({ id: 'r1', content: 'x' });

      const result = await service.submitAnswer(USER_ID, SESSION_ID, {
        questionId: 'p1',
        content: 'x',
      });

      expect(result.allAnswered).toBe(true);
      expect(prisma.session.update).not.toHaveBeenCalled();
    });
  });

  describe('generateReport (UC-14)', () => {
    const armReport = (overrides: Record<string, unknown> = {}) => {
      prisma.session.findFirst
        .mockResolvedValueOnce(makeSessionRow({ report: null }))
        .mockResolvedValueOnce(
          makeSessionRow({
            vacancy: makeVacancy(),
            repos: [makeSessionRepoRow()],
            questions: [
              makeQuestionRow({
                id: 'p1',
                answer: { content: 'resposta 1', createdAt: new Date() },
              }),
            ],
            ...overrides,
          }),
        );
      reportGenerator.generate.mockResolvedValue(makeAiReport());
      prisma.report.create.mockResolvedValue(makeReportRow());
      prisma.session.update.mockResolvedValue(undefined);
    };

    it('CT-14.1 🔒 recusa sessão de outro usuário', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(service.generateReport(OTHER_USER, SESSION_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(reportGenerator.generate).not.toHaveBeenCalled();
    });

    it('CT-14.2 devolve o relatório existente sem chamar a IA de novo', async () => {
      prisma.session.findFirst.mockResolvedValue(makeSessionRow({ report: makeReportRow() }));

      const result = await service.generateReport(USER_ID, SESSION_ID);

      expect(result.overallScore).toBe(72);
      expect(reportGenerator.generate).not.toHaveBeenCalled();
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it('CT-14.3 recusa gerar com perguntas sem resposta', async () => {
      armReport({ questions: [makeQuestionRow({ id: 'p1', answer: null })] });

      const err = await service.generateReport(USER_ID, SESSION_ID).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect(httpBody(err).code).toBe('respostas_pendentes');
      expect(reportGenerator.generate).not.toHaveBeenCalled();
    });

    it('CT-14.4 persiste o relatório e conclui a sessão', async () => {
      armReport();

      const result = await service.generateReport(USER_ID, SESSION_ID);

      expect(prisma.report.create).toHaveBeenCalledWith({
        data: like({
          sessionId: SESSION_ID,
          overallScore: 72,
          adherenceScore: 40,
        }),
      });
      const [[{ data }]] = prisma.session.update.mock.calls as [
        [{ data: { status: string; completedAt: Date } }],
      ];
      expect(data.status).toBe('completed');
      expect(data.completedAt).toBeInstanceOf(Date);
      expect(result.sessionId).toBe(SESSION_ID);
    });

    it('CT-14.5 manda para a IA só os trechos de código completos', async () => {
      armReport({
        questions: [
          makeQuestionRow({
            id: 'p1',
            metadata: { codeFile: 'src/app.ts', codeExcerpt: 'const a = 1;' },
            answer: { content: 'r1', createdAt: new Date() },
          }),
          makeQuestionRow({
            id: 'p2',
            metadata: { codeFile: 'src/sem-trecho.ts' },
            answer: { content: 'r2', createdAt: new Date() },
          }),
          makeQuestionRow({
            id: 'p3',
            metadata: null,
            answer: { content: 'r3', createdAt: new Date() },
          }),
        ],
      });

      await service.generateReport(USER_ID, SESSION_ID);

      const [input] = reportGenerator.generate.mock.calls[0] as [
        { repo: { codeSamples: unknown[] }; answeredQuestions: unknown[] },
      ];
      expect(input.repo.codeSamples).toEqual([{ file: 'src/app.ts', excerpt: 'const a = 1;' }]);
      expect(input.answeredQuestions).toHaveLength(3);
    });

    it('CT-14.6 tolera sessão sem repositório associado', async () => {
      armReport({ repos: [] });

      await service.generateReport(USER_ID, SESSION_ID);

      const [input] = reportGenerator.generate.mock.calls[0] as [
        { repo: { fullName: string; filePaths: string[] } },
      ];
      expect(input.repo.fullName).toBe('');
      expect(input.repo.filePaths).toEqual([]);
    });

    it('CT-14.6b tolera snapshot de arquivos nulo', async () => {
      armReport({ repos: [makeSessionRepoRow({ selectedFilesSnapshot: null })] });

      await service.generateReport(USER_ID, SESSION_ID);

      const [input] = reportGenerator.generate.mock.calls[0] as [{ repo: { filePaths: string[] } }];
      expect(input.repo.filePaths).toEqual([]);
    });

    it('CT-14.7 converte falha da IA em 502 ia_indisponivel_relatorio', async () => {
      armReport();
      reportGenerator.generate.mockRejectedValue(
        new ReportGenerationError('invalid_response', 'formato inesperado'),
      );

      const err = await service.generateReport(USER_ID, SESSION_ID).catch((e: unknown) => e);

      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(httpBody(err)).toEqual({
        code: 'ia_indisponivel_relatorio',
        message: 'formato inesperado',
        retryable: true,
      });
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it('CT-14.8 devolve o relatório do vencedor quando duas chamadas competem (P2002)', async () => {
      armReport();
      prisma.report.create.mockRejectedValue(p2002());
      prisma.report.findUnique.mockResolvedValue(makeReportRow({ overallScore: 99 }));

      const result = await service.generateReport(USER_ID, SESSION_ID);

      expect(result.overallScore).toBe(99);
      expect(prisma.report.findUnique).toHaveBeenCalledWith({ where: { sessionId: SESSION_ID } });
      expect(prisma.session.update).not.toHaveBeenCalled();
    });

    it('CT-14.9 repropaga o P2002 quando o relatório concorrente não é encontrado', async () => {
      armReport();
      const erro = p2002();
      prisma.report.create.mockRejectedValue(erro);
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(service.generateReport(USER_ID, SESSION_ID)).rejects.toBe(erro);
    });

    it('CT-14.10 repropaga erro do Prisma que não é P2002', async () => {
      armReport();
      const erro = new Prisma.PrismaClientKnownRequestError('conexão perdida', {
        code: 'P1001',
        clientVersion: '7.9.1',
      });
      prisma.report.create.mockRejectedValue(erro);

      await expect(service.generateReport(USER_ID, SESSION_ID)).rejects.toBe(erro);
      expect(prisma.report.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getReport (UC-14)', () => {
    it('CT-14.1b 🔒 recusa sessão de outro usuário', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(service.getReport(OTHER_USER, SESSION_ID)).rejects.toThrow(NotFoundException);
    });

    it('CT-14.11 devolve null quando a sessão ainda não tem relatório', async () => {
      prisma.session.findFirst.mockResolvedValue(makeSessionRow({ report: null }));

      await expect(service.getReport(USER_ID, SESSION_ID)).resolves.toBeNull();
    });

    it('CT-14.12 normaliza adherenceNotes nulo para lista vazia', async () => {
      prisma.session.findFirst.mockResolvedValue(
        makeSessionRow({ report: makeReportRow({ adherenceNotes: null }) }),
      );

      const result = await service.getReport(USER_ID, SESSION_ID);

      expect(result?.adherenceNotes).toEqual([]);
      expect(result?.dimensionScores).toEqual([{ label: 'Lógica', score: 80 }]);
    });
  });

  describe('findMany / findOne / remove (UC-15)', () => {
    it('CT-15.1 lista apenas as sessões do usuário, da mais recente para a mais antiga', async () => {
      prisma.session.findMany.mockResolvedValue([]);

      await service.findMany(USER_ID);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        like({
          where: { userId: USER_ID },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('CT-15.2 resume sessão sem repositório com repo nulo', async () => {
      prisma.session.findMany.mockResolvedValue([
        makeSessionRow({
          vacancy: makeVacancy({ parsedSeniority: null, parsedStack: null }),
          repos: [],
          questions: [makeQuestionRow()],
          report: null,
        }),
      ]);

      const [resumo] = await service.findMany(USER_ID);

      expect(resumo.repo).toBeNull();
      expect(resumo.report).toBeNull();
      expect(resumo.questionCount).toBe(1);
      expect(resumo.vacancy).toEqual({ seniorityLevel: 'unknown', technologies: [] });
    });

    it('CT-15.3 traz os dois scores no resumo de sessão com relatório', async () => {
      prisma.session.findMany.mockResolvedValue([
        makeSessionRow({
          vacancy: makeVacancy(),
          repos: [makeSessionRepoRow()],
          questions: [],
          report: makeReportRow(),
        }),
      ]);

      const [resumo] = await service.findMany(USER_ID);

      expect(resumo.repo).toEqual({ fullName: 'candidato/meu-projeto' });
      expect(resumo.report).toEqual({ overallScore: 72, adherenceScore: 40 });
    });

    it('CT-15.4 🔒 recusa detalhar sessão alheia', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(service.findOne(OTHER_USER, SESSION_ID)).rejects.toThrow(NotFoundException);
    });

    it('CT-15.5 pede as perguntas ordenadas e devolve a resposta de cada uma', async () => {
      const createdAt = new Date();
      prisma.session.findFirst.mockResolvedValue(
        makeSessionRow({
          repos: [makeSessionRepoRow()],
          questions: [
            makeQuestionRow({ id: 'p1', answer: { content: 'r1', createdAt } }),
            makeQuestionRow({ id: 'p2', orderIndex: 2, answer: null }),
          ],
        }),
      );

      const result = await service.findOne(USER_ID, SESSION_ID);

      expect(prisma.session.findFirst).toHaveBeenCalledWith(
        like({
          where: { id: SESSION_ID, userId: USER_ID },
          include: like({
            questions: { orderBy: { orderIndex: 'asc' }, include: { answer: true } },
          }),
        }),
      );
      expect(result.repo).toEqual({
        fullName: 'candidato/meu-projeto',
        url: 'https://github.com/candidato/meu-projeto',
        primaryLanguage: 'TypeScript',
      });
      expect(result.questions[0].answer).toEqual({ content: 'r1', createdAt });
      expect(result.questions[1].answer).toBeNull();
      expect(result.repoAnalysis).toBeUndefined();
    });

    it('CT-15.5b devolve repo nulo quando a sessão não tem repositório', async () => {
      prisma.session.findFirst.mockResolvedValue(makeSessionRow({ repos: [], questions: [] }));

      const result = await service.findOne(USER_ID, SESSION_ID);

      expect(result.repo).toBeNull();
    });

    it('CT-15.6 🔒 não apaga sessão de outro usuário', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(service.remove(OTHER_USER, SESSION_ID)).rejects.toThrow(NotFoundException);
      expect(prisma.session.delete).not.toHaveBeenCalled();
    });

    it('CT-15.7 apaga a sessão do próprio usuário', async () => {
      prisma.session.findFirst.mockResolvedValue(makeSessionRow());
      prisma.session.delete.mockResolvedValue(undefined);

      await service.remove(USER_ID, SESSION_ID);

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: SESSION_ID } });
    });
  });
});
