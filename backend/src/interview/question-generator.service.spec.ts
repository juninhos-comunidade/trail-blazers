import { Test, TestingModule } from '@nestjs/testing';
import { QuestionGenerationError, QuestionGeneratorService } from './question-generator.service';
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
  files: [{ path: 'src/app.ts', content: 'const a = 1;' }],
  count: 8,
};

const validQuestions = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    questions: [
      { type: 'logic', content: 'Uma pergunta de aquecimento sobre lógica.' },
      {
        type: 'code_analysis',
        content: 'O que este trecho de código faz?',
        codeFile: 'src/app.ts',
        codeExcerpt: 'const a = 1;',
        ...extra,
      },
    ],
  });

const reasonOf = (err: unknown) => (err as QuestionGenerationError).reason;

describe('QuestionGeneratorService', () => {
  let service: QuestionGeneratorService;
  let ai: { complete: jest.Mock };

  beforeEach(async () => {
    ai = { complete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionGeneratorService, { provide: AiProviderPort, useValue: ai }],
    }).compile();

    service = module.get(QuestionGeneratorService);
  });

  const lastCall = () => ai.complete.mock.calls[0] as [string, string, number];

  const sentPayload = () =>
    JSON.parse(lastCall()[1]) as {
      vacancy: { descriptionExcerpt: string };
      questionCount: number;
      files: { path: string; content: string }[];
    };

  it('CT-10.1 devolve as perguntas validadas', async () => {
    ai.complete.mockResolvedValue(validQuestions());

    const result = await service.generate(INPUT);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'logic',
      content: 'Uma pergunta de aquecimento sobre lógica.',
    });
    expect(result[1].codeFile).toBe('src/app.ts');
  });

  it('CT-10.2 injeta a quantidade pedida no system prompt', async () => {
    ai.complete.mockResolvedValue(validQuestions());

    await service.generate({ ...INPUT, count: 5 });

    expect(lastCall()[0]).toContain('Gere exatamente 5 perguntas');
    expect(lastCall()[0]).not.toContain('{count}');
    expect(sentPayload().questionCount).toBe(5);
  });

  it('CT-10.3 usa o timeout estendido de 60s', async () => {
    ai.complete.mockResolvedValue(validQuestions());

    await service.generate(INPUT);

    expect(lastCall()[2]).toBe(60_000);
  });

  it('CT-10.4 trunca o conteúdo de cada arquivo em 6.000 caracteres', async () => {
    ai.complete.mockResolvedValue(validQuestions());

    await service.generate({
      ...INPUT,
      files: [{ path: 'src/grande.ts', content: 'x'.repeat(10_000) }],
    });

    expect(sentPayload().files[0].content).toHaveLength(6000);
    expect(sentPayload().files[0].path).toBe('src/grande.ts');
  });

  it('CT-10.5 trunca a descrição da vaga em 3.000 caracteres', async () => {
    ai.complete.mockResolvedValue(validQuestions());

    await service.generate({ ...INPUT, rawDescription: 'a'.repeat(9000) });

    expect(sentPayload().vacancy.descriptionExcerpt).toHaveLength(3000);
  });

  it('CT-10.6 aceita resposta embrulhada em cerca markdown', async () => {
    ai.complete.mockResolvedValue('```json\n' + validQuestions() + '\n```');

    await expect(service.generate(INPUT)).resolves.toHaveLength(2);
  });

  it('CT-10.7 falha quando a resposta não é JSON', async () => {
    ai.complete.mockResolvedValue('não posso responder isso');

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(QuestionGenerationError);
    expect(reasonOf(err)).toBe('invalid_response');
    expect((err as QuestionGenerationError).message).toBe('A IA não devolveu um JSON válido.');
  });

  it.each([
    [
      'tipo fora do enum',
      JSON.stringify({ questions: [{ type: 'quiz', content: 'a'.repeat(20) }] }),
    ],
    ['conteúdo curto demais', JSON.stringify({ questions: [{ type: 'logic', content: 'oi' }] })],
    [
      'trecho de código gigante',
      JSON.stringify({
        questions: [
          { type: 'code_analysis', content: 'a'.repeat(20), codeExcerpt: 'x'.repeat(4001) },
        ],
      }),
    ],
    ['lista vazia', JSON.stringify({ questions: [] })],
    [
      'mais de 12 perguntas',
      JSON.stringify({
        questions: Array.from({ length: 13 }, () => ({ type: 'logic', content: 'a'.repeat(20) })),
      }),
    ],
  ])('CT-10.8/10.9/10.10 rejeita resposta com %s', async (_caso, payload) => {
    ai.complete.mockResolvedValue(payload);

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('invalid_response');
  });

  it.each<[AiErrorKind, string]>([
    ['invalid_api_key', 'invalid_api_key'],
    ['timeout', 'timeout'],
    ['unavailable', 'ai_unavailable'],
    ['rate_limited', 'rate_limited'],
    ['payment_required', 'payment_required'],
  ])('CT-10.11 traduz AiError %s em reason %s', async (kind, reason) => {
    ai.complete.mockRejectedValue(new AiError(kind, 'a IA reclamou'));

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe(reason);
  });

  it('CT-10.11b usa ai_unavailable para erro que não é AiError', async () => {
    ai.complete.mockRejectedValue(new Error('socket hang up'));

    const err = await service.generate(INPUT).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('ai_unavailable');
    expect((err as QuestionGenerationError).message).toBe('A chamada à IA não foi concluída.');
  });
});
