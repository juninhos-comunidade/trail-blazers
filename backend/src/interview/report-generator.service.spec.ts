import { Test, TestingModule } from '@nestjs/testing';
import { ReportGenerationError, ReportGeneratorService } from './report-generator.service';
import { AiError, AiErrorKind, AiProviderPort } from '../vacancies/vacancy-parser.service';
import type { ParsedVacancyProfile } from '../vacancies/schemas/vacancy.schema';

const PROFILE: ParsedVacancyProfile = {
  technologies: ['Node.js'],
  seniorityLevel: 'mid',
  keyCompetencies: ['APIs REST'],
  confidence: 'high',
  outOfScope: false,
};

const INPUT = {
  rawDescription: 'Vaga de backend Node.js',
  profile: PROFILE,
  repo: {
    fullName: 'candidato/meu-projeto',
    filePaths: ['src/app.ts'],
    codeSamples: [{ file: 'src/app.ts', excerpt: 'const a = 1;' }],
  },
  answeredQuestions: [{ type: 'logic', content: 'Pergunta?', answer: 'Resposta.' }],
};

const validReport = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    overallScore: 72,
    adherenceScore: 40,
    adherenceNotes: [{ title: 'Stack', text: 'Bate parcialmente.' }],
    dimensionScores: [{ label: 'Lógica', score: 80 }],
    strengths: [{ title: 'Clareza', text: 'Explicou bem.' }],
    gaps: [{ title: 'Testes', text: 'Não mencionou.' }],
    recommendations: [{ title: 'Estudar', text: 'Aprofundar em Node.' }],
    ...overrides,
  });

const reasonOf = (err: unknown) => (err as ReportGenerationError).reason;

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let ai: { complete: jest.Mock };

  beforeEach(async () => {
    ai = { complete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportGeneratorService, { provide: AiProviderPort, useValue: ai }],
    }).compile();

    service = module.get(ReportGeneratorService);
  });

  const lastCall = () => ai.complete.mock.calls[0] as [string, string, number];

  it('CT-11.1 devolve os dois scores e as dimensões', async () => {
    ai.complete.mockResolvedValue(validReport());

    const result = await service.generate(INPUT);

    expect(result.overallScore).toBe(72);
    expect(result.adherenceScore).toBe(40);
    expect(result.dimensionScores).toEqual([{ label: 'Lógica', score: 80 }]);
    expect(result.adherenceNotes).toEqual([{ title: 'Stack', text: 'Bate parcialmente.' }]);
  });

  it('CT-11.1b envia perfil, repositório e respostas no payload', async () => {
    ai.complete.mockResolvedValue(validReport());

    await service.generate(INPUT);

    const payload = JSON.parse(lastCall()[1]) as {
      repo: typeof INPUT.repo;
      answeredQuestions: typeof INPUT.answeredQuestions;
      vacancy: { descriptionExcerpt: string };
    };
    expect(payload.repo).toEqual(INPUT.repo);
    expect(payload.answeredQuestions).toEqual(INPUT.answeredQuestions);
    expect(payload.vacancy.descriptionExcerpt).toBe('Vaga de backend Node.js');
  });

  it('CT-11.2 usa o timeout estendido de 60s', async () => {
    ai.complete.mockResolvedValue(validReport());

    await service.generate(INPUT);

    expect(lastCall()[2]).toBe(60_000);
  });

  it('CT-11.2b trunca a descrição da vaga em 3.000 caracteres', async () => {
    ai.complete.mockResolvedValue(validReport());

    await service.generate({ ...INPUT, rawDescription: 'a'.repeat(9000) });

    const payload = JSON.parse(lastCall()[1]) as { vacancy: { descriptionExcerpt: string } };
    expect(payload.vacancy.descriptionExcerpt).toHaveLength(3000);
  });

  it.each([
    ['overallScore acima de 100', validReport({ overallScore: 120 })],
    ['adherenceScore negativo', validReport({ adherenceScore: -1 })],
    [
      'nota de dimensão fora da faixa',
      validReport({ dimensionScores: [{ label: 'X', score: 101 }] }),
    ],
  ])('CT-11.3 rejeita relatório com %s', async (_caso, payload) => {
    ai.complete.mockResolvedValue(payload);

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ReportGenerationError);
    expect(reasonOf(err)).toBe('invalid_response');
  });

  it.each([
    ['vazio', validReport({ dimensionScores: [] })],
    [
      'com 9 itens',
      validReport({
        dimensionScores: Array.from({ length: 9 }, (_, i) => ({ label: `d${i}`, score: 50 })),
      }),
    ],
  ])('CT-11.4 rejeita dimensionScores %s', async (_caso, payload) => {
    ai.complete.mockResolvedValue(payload);

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('invalid_response');
  });

  it('CT-11.5 aplica lista vazia como default para strengths, gaps e recommendations', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({
        overallScore: 50,
        adherenceScore: 50,
        adherenceNotes: [{ title: 'Stack', text: 'Bate.' }],
        dimensionScores: [{ label: 'Lógica', score: 50 }],
      }),
    );

    const result = await service.generate(INPUT);

    expect(result.strengths).toEqual([]);
    expect(result.gaps).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it('CT-11.5b aceita relatório sem adherenceNotes, usando o default declarado', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({
        overallScore: 50,
        adherenceScore: 50,
        dimensionScores: [{ label: 'Lógica', score: 50 }],
      }),
    );

    const result = await service.generate(INPUT);

    expect(result.adherenceNotes).toEqual([]);
  });

  it('CT-11.6 aceita cerca markdown e rejeita resposta que não é JSON', async () => {
    ai.complete.mockResolvedValue('```json\n' + validReport() + '\n```');
    await expect(service.generate(INPUT)).resolves.toMatchObject({ overallScore: 72 });

    ai.complete.mockResolvedValue('não consigo gerar o relatório');
    const err = await service.generate(INPUT).catch((e: unknown) => e);
    expect(reasonOf(err)).toBe('invalid_response');
  });

  it.each<[AiErrorKind, string]>([
    ['invalid_api_key', 'invalid_api_key'],
    ['timeout', 'timeout'],
    ['unavailable', 'ai_unavailable'],
    ['rate_limited', 'rate_limited'],
    ['payment_required', 'payment_required'],
  ])('CT-11.7 traduz AiError %s em reason %s', async (kind, reason) => {
    ai.complete.mockRejectedValue(new AiError(kind, 'a IA reclamou'));

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe(reason);
  });

  it('CT-11.7b usa ai_unavailable para erro que não é AiError', async () => {
    ai.complete.mockRejectedValue(new Error('socket hang up'));

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('ai_unavailable');
  });
});
