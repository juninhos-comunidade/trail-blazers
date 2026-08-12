import { Test, TestingModule } from '@nestjs/testing';
import { FileSelectionError, RepoFileSelectorService } from './repo-file-selector.service';
import { AiError, AiErrorKind, AiProviderPort } from '../vacancies/vacancy-parser.service';
import type { ParsedVacancyProfile } from '../vacancies/schemas/vacancy.schema';

const PROFILE: ParsedVacancyProfile = {
  technologies: ['Node.js'],
  seniorityLevel: 'mid',
  keyCompetencies: ['APIs REST'],
  confidence: 'high',
  outOfScope: false,
};

const VACANCY = { rawDescription: 'Vaga de backend Node.js', profile: PROFILE };

const reasonOf = (err: unknown) => (err as FileSelectionError).reason;

describe('RepoFileSelectorService', () => {
  let service: RepoFileSelectorService;
  let ai: { complete: jest.Mock };

  beforeEach(async () => {
    ai = { complete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RepoFileSelectorService, { provide: AiProviderPort, useValue: ai }],
    }).compile();

    service = module.get(RepoFileSelectorService);
  });

  const sentPayload = () => {
    const [, userMessage] = ai.complete.mock.calls[0] as [string, string];
    return JSON.parse(userMessage) as {
      files: string[];
      vacancy: { descriptionExcerpt: string };
    };
  };

  it('CT-09.1 preserva a ordem de relevância escolhida pela IA', async () => {
    ai.complete.mockResolvedValue(JSON.stringify({ relevantFiles: ['src/b.ts', 'src/a.ts'] }));

    const result = await service.selectRelevantFiles(['src/a.ts', 'src/b.ts'], VACANCY);

    expect(result).toEqual(['src/b.ts', 'src/a.ts']);
  });

  it('CT-09.2 🔒 descarta paths que a IA inventou', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({
        relevantFiles: ['src/a.ts', '../../etc/passwd', 'src/nao-existe.ts'],
      }),
    );

    const result = await service.selectRelevantFiles(['src/a.ts', 'src/b.ts'], VACANCY);

    expect(result).toEqual(['src/a.ts']);
  });

  it('CT-09.3 deduplica paths repetidos na resposta', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({ relevantFiles: ['src/a.ts', 'src/a.ts', 'src/b.ts'] }),
    );

    const result = await service.selectRelevantFiles(['src/a.ts', 'src/b.ts'], VACANCY);

    expect(result).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('CT-09.4 falha quando nenhum path devolvido existe no repositório', async () => {
    ai.complete.mockResolvedValue(JSON.stringify({ relevantFiles: ['inventado.ts'] }));

    const err = await service.selectRelevantFiles(['src/a.ts'], VACANCY).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(FileSelectionError);
    expect(reasonOf(err)).toBe('invalid_response');
  });

  it('CT-09.5 aceita resposta embrulhada em cerca markdown', async () => {
    ai.complete.mockResolvedValue('```json\n{"relevantFiles":["src/a.ts"]}\n```');

    await expect(service.selectRelevantFiles(['src/a.ts'], VACANCY)).resolves.toEqual(['src/a.ts']);
  });

  it('CT-09.6 falha quando a resposta não é JSON', async () => {
    ai.complete.mockResolvedValue('desculpe, não consigo ajudar com isso');

    const err = await service.selectRelevantFiles(['src/a.ts'], VACANCY).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('invalid_response');
  });

  it.each([
    ['sem a chave relevantFiles', JSON.stringify({ arquivos: ['src/a.ts'] })],
    ['com lista vazia', JSON.stringify({ relevantFiles: [] })],
    [
      'com mais de 80 arquivos',
      JSON.stringify({ relevantFiles: Array.from({ length: 81 }, (_, i) => `src/f${i}.ts`) }),
    ],
    ['com item que não é string', JSON.stringify({ relevantFiles: [42] })],
  ])('CT-09.7 rejeita resposta %s', async (_caso, payload) => {
    ai.complete.mockResolvedValue(payload);

    const err = await service.selectRelevantFiles(['src/a.ts'], VACANCY).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('invalid_response');
  });

  it.each<[AiErrorKind, string]>([
    ['invalid_api_key', 'invalid_api_key'],
    ['timeout', 'timeout'],
    ['unavailable', 'ai_unavailable'],
    ['rate_limited', 'rate_limited'],
    ['payment_required', 'payment_required'],
  ])('CT-09.8 traduz AiError %s em reason %s', async (kind, reason) => {
    ai.complete.mockRejectedValue(new AiError(kind, 'a IA reclamou'));

    const err = await service.selectRelevantFiles(['src/a.ts'], VACANCY).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe(reason);
    expect((err as FileSelectionError).message).toBe('a IA reclamou');
  });

  it('CT-09.9 usa ai_unavailable para erro que não é AiError', async () => {
    ai.complete.mockRejectedValue(new Error('socket hang up'));

    const err = await service.selectRelevantFiles(['src/a.ts'], VACANCY).catch((e: unknown) => e);

    expect(reasonOf(err)).toBe('ai_unavailable');
    expect((err as FileSelectionError).message).toBe('A chamada à IA não foi concluída.');
  });

  it('CT-09.10 envia no máximo 300 paths à IA', async () => {
    const paths = Array.from({ length: 400 }, (_, i) => `src/f${i}.ts`);
    ai.complete.mockResolvedValue(JSON.stringify({ relevantFiles: ['src/f0.ts'] }));

    await service.selectRelevantFiles(paths, VACANCY);

    expect(sentPayload().files).toHaveLength(300);
    expect(sentPayload().files.at(-1)).toBe('src/f299.ts');
  });

  it('CT-09.11 trunca a descrição da vaga em 2.000 caracteres', async () => {
    ai.complete.mockResolvedValue(JSON.stringify({ relevantFiles: ['src/a.ts'] }));

    await service.selectRelevantFiles(['src/a.ts'], {
      ...VACANCY,
      rawDescription: 'a'.repeat(5000),
    });

    expect(sentPayload().vacancy.descriptionExcerpt).toHaveLength(2000);
  });
});
