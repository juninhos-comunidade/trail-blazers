import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VacanciesService } from './vacancies.service';
import { PrismaService } from '../prisma/prisma.service';
import { VacancyParserService } from './vacancy-parser.service';
import { VACANCY_MIN_LENGTH, type ParsedVacancyProfile } from './schemas/vacancy.schema';

const USER_ID = 'user-abc';
const VALID_DESC = 'a'.repeat(VACANCY_MIN_LENGTH + 10);

const GENERIC_PROFILE: ParsedVacancyProfile = {
  technologies: [],
  seniorityLevel: 'unknown',
  keyCompetencies: [],
  confidence: 'low',
  outOfScope: false,
};

const TECH_PROFILE: ParsedVacancyProfile = {
  technologies: ['Node.js', 'TypeScript'],
  seniorityLevel: 'mid',
  keyCompetencies: ['APIs REST'],
  confidence: 'high',
  outOfScope: false,
};

/** Fixture no shape do BANCO (o que o Prisma devolve), não no shape da resposta. */
const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'vaga-1',
  userId: USER_ID,
  rawDescription: VALID_DESC,
  parsedStack: null,
  parsedSeniority: null,
  parsedSkills: null,
  parseConfidence: null,
  parsedOutOfScope: null,
  createdAt: new Date(),
  ...overrides,
});

/** Deixa a fila de microtasks drenar para o parsing em background concluir. */
const flushBackground = () => new Promise((r) => setTimeout(r, 20));

/** Dados passados ao `prisma.vacancy.update` na chamada mais recente. */
const lastUpdateData = (update: jest.Mock): Record<string, unknown> => {
  const call = update.mock.calls.at(-1) as [{ data: Record<string, unknown> }] | undefined;
  return call?.[0].data ?? {};
};

describe('VacanciesService', () => {
  let service: VacanciesService;
  let prisma: { vacancy: Record<string, jest.Mock> };
  let parser: jest.Mocked<VacancyParserService>;

  beforeEach(async () => {
    prisma = {
      vacancy: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    parser = { parse: jest.fn() } as unknown as jest.Mocked<VacancyParserService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VacanciesService,
        { provide: PrismaService, useValue: prisma },
        { provide: VacancyParserService, useValue: parser },
      ],
    }).compile();

    service = module.get(VacanciesService);
  });

  // ─── RF-2.1 AC1 — persiste e responde antes do parsing ────────────────────

  it('cria vaga e retorna imediatamente com parsingCompleted=false', async () => {
    prisma.vacancy.create.mockResolvedValue(makeRow());
    parser.parse.mockResolvedValue(GENERIC_PROFILE);
    prisma.vacancy.update.mockResolvedValue(undefined);

    const result = await service.create(USER_ID, { description: VALID_DESC });

    expect(result.id).toBe('vaga-1');
    expect(result.parsingCompleted).toBe(false);
    expect(result.parsedProfile).toBeNull();
    expect(prisma.vacancy.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, rawDescription: VALID_DESC },
    });
  });

  // ─── RF-2.2 — o parsing grava o perfil em background ──────────────────────

  it('grava o perfil analisado no banco após o parsing', async () => {
    prisma.vacancy.create.mockResolvedValue(makeRow());
    parser.parse.mockResolvedValue(TECH_PROFILE);
    prisma.vacancy.update.mockResolvedValue(undefined);

    await service.create(USER_ID, { description: VALID_DESC });
    await flushBackground();

    expect(prisma.vacancy.update).toHaveBeenCalledWith({
      where: { id: 'vaga-1' },
      data: {
        parsedStack: ['Node.js', 'TypeScript'],
        parsedSeniority: 'mid',
        parsedSkills: ['APIs REST'],
        parseConfidence: 1.0,
        parsedOutOfScope: false,
      },
    });
  });

  it('persiste outOfScope=true para vaga fora do escopo tech', async () => {
    prisma.vacancy.create.mockResolvedValue(makeRow());
    parser.parse.mockResolvedValue({ ...GENERIC_PROFILE, outOfScope: true });
    prisma.vacancy.update.mockResolvedValue(undefined);

    await service.create(USER_ID, { description: VALID_DESC });
    await flushBackground();

    expect(lastUpdateData(prisma.vacancy.update).parsedOutOfScope).toBe(true);
  });

  // ─── o parsing nunca pode derrubar o cadastro ─────────────────────────────

  it('não rejeita o cadastro quando o parser lança', async () => {
    prisma.vacancy.create.mockResolvedValue(makeRow());
    parser.parse.mockRejectedValue(new Error('boom'));
    prisma.vacancy.update.mockResolvedValue(undefined);

    const result = await service.create(USER_ID, { description: VALID_DESC });
    await flushBackground();

    expect(result.id).toBe('vaga-1');
  });

  it('grava perfil vazio quando o parser lança, para o polling terminar', async () => {
    prisma.vacancy.create.mockResolvedValue(makeRow());
    parser.parse.mockRejectedValue(new Error('boom'));
    prisma.vacancy.update.mockResolvedValue(undefined);

    await service.create(USER_ID, { description: VALID_DESC });
    await flushBackground();

    expect(lastUpdateData(prisma.vacancy.update).parseConfidence).toBe(0.5);
  });

  it('não derruba o processo quando a gravação no banco falha', async () => {
    prisma.vacancy.create.mockResolvedValue(makeRow());
    parser.parse.mockResolvedValue(GENERIC_PROFILE);
    prisma.vacancy.update.mockRejectedValue(new Error('db fora do ar'));

    await expect(service.create(USER_ID, { description: VALID_DESC })).resolves.toBeDefined();
    await flushBackground();
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  it('lança NotFoundException para vaga inexistente', async () => {
    prisma.vacancy.findFirst.mockResolvedValue(null);

    await expect(service.findOne('id-errado', USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('reconstrói o parsedProfile a partir das colunas do banco', async () => {
    prisma.vacancy.findFirst.mockResolvedValue(
      makeRow({
        parsedStack: ['Node.js', 'TypeScript'],
        parsedSeniority: 'mid',
        parsedSkills: ['APIs REST'],
        parseConfidence: 1.0,
        parsedOutOfScope: false,
      }),
    );

    const result = await service.findOne('vaga-1', USER_ID);

    expect(result.parsingCompleted).toBe(true);
    expect(result.parsedProfile).toEqual(TECH_PROFILE);
    expect(prisma.vacancy.findFirst).toHaveBeenCalledWith({
      where: { id: 'vaga-1', userId: USER_ID },
    });
  });

  it('devolve outOfScope=true quando a coluna está marcada', async () => {
    prisma.vacancy.findFirst.mockResolvedValue(
      makeRow({ parseConfidence: 0.5, parsedOutOfScope: true }),
    );

    const result = await service.findOne('vaga-1', USER_ID);

    expect(result.parsedProfile?.outOfScope).toBe(true);
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  it('retorna lista de vagas do usuário em ordem decrescente', async () => {
    prisma.vacancy.findMany.mockResolvedValue([makeRow({ id: 'v2' }), makeRow({ id: 'v1' })]);

    const result = await service.findAllByUser(USER_ID);

    expect(result).toHaveLength(2);
    expect(prisma.vacancy.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'desc' },
    });
  });
});
