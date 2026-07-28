import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JobVacancyService } from './job-vacancy.service';
import { PrismaService } from '../prisma/prisma.service';
import { VacancyParserService } from '../ai/vacancy-parser.service';
import { VACANCY_MIN_LENGTH } from './schemas/job-vacancy.schema';

const USER_ID = 'user-abc';
const VALID_DESC = 'a'.repeat(VACANCY_MIN_LENGTH + 10);

const GENERIC_PROFILE = {
  technologies: [],
  seniorityLevel: 'unknown' as const,
  keyCompetencies: [],
  confidence: 'low' as const,
  outOfScope: false,
};

const makeVacancy = (overrides = {}) => ({
  id: 'vaga-1',
  userId: USER_ID,
  description: VALID_DESC,
  parsedProfile: null,
  parsingCompleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('JobVacancyService', () => {
  let service: JobVacancyService;
  let prisma: { jobVacancy: Record<string, jest.Mock> };
  let parser: jest.Mocked<VacancyParserService>;

  beforeEach(async () => {
    prisma = {
      jobVacancy: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    parser = { parse: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobVacancyService,
        { provide: PrismaService, useValue: prisma },
        { provide: VacancyParserService, useValue: parser },
      ],
    }).compile();

    service = module.get(JobVacancyService);
  });

  // ─── RF-2.1 AC1 — persiste antes de retornar ──────────────────────────────

  it('cria vaga e retorna imediatamente com parsingCompleted=false', async () => {
    const saved = makeVacancy();
    prisma.jobVacancy.create.mockResolvedValue(saved);
    parser.parse.mockResolvedValue(GENERIC_PROFILE);
    prisma.jobVacancy.update.mockResolvedValue(undefined);

    const result = await service.create(USER_ID, { description: VALID_DESC });

    expect(result.id).toBe('vaga-1');
    expect(result.parsingCompleted).toBe(false);
    expect(prisma.jobVacancy.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, description: VALID_DESC },
    });
  });

  it('atualiza parsedProfile e parsingCompleted=true após parsing', async () => {
    const saved = makeVacancy();
    prisma.jobVacancy.create.mockResolvedValue(saved);
    parser.parse.mockResolvedValue(GENERIC_PROFILE);
    prisma.jobVacancy.update.mockResolvedValue(undefined);

    await service.create(USER_ID, { description: VALID_DESC });

    // Aguarda a Promise do background resolver
    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.jobVacancy.update).toHaveBeenCalledWith({
      where: { id: 'vaga-1' },
      data: {
        parsedProfile: GENERIC_PROFILE,
        parsingCompleted: true,
      },
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  it('lança NotFoundException para vaga inexistente', async () => {
    prisma.jobVacancy.findFirst.mockResolvedValue(null);

    await expect(service.findOne('id-errado', USER_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retorna a vaga correta ao buscar por id e userId', async () => {
    const v = makeVacancy({ parsedProfile: GENERIC_PROFILE, parsingCompleted: true });
    prisma.jobVacancy.findFirst.mockResolvedValue(v);

    const result = await service.findOne('vaga-1', USER_ID);

    expect(result.parsingCompleted).toBe(true);
    expect(result.parsedProfile).toEqual(GENERIC_PROFILE);
    expect(prisma.jobVacancy.findFirst).toHaveBeenCalledWith({
      where: { id: 'vaga-1', userId: USER_ID },
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  it('retorna lista de vagas do usuário em ordem decrescente', async () => {
    const list = [makeVacancy({ id: 'v2' }), makeVacancy({ id: 'v1' })];
    prisma.jobVacancy.findMany.mockResolvedValue(list);

    const result = await service.findAllByUser(USER_ID);

    expect(result).toHaveLength(2);
    expect(prisma.jobVacancy.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'desc' },
    });
  });
});
