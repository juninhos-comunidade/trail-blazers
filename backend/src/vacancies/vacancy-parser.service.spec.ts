import { Test, TestingModule } from '@nestjs/testing';
import { VacancyParserService, AiProviderPort } from './vacancy-parser.service';

const TECH_VACANCY = `
Vaga: Desenvolvedor Node.js Pleno
Buscamos desenvolvedor para atuar no backend com Node.js, TypeScript, PostgreSQL, Docker e AWS.
Diferenciais: NestJS, Kubernetes, Redis.
Responsabilidades: projetar APIs REST, revisar código, participar de refinamentos.
`;

const NON_TECH_VACANCY = `
Gerente de Marketing Digital.
Gestão de campanhas no Google Ads e Meta Ads.
Requisitos: graduação em Marketing ou Comunicação, experiência com SEO e CRM.
`;

describe('VacancyParserService', () => {
  let service: VacancyParserService;
  let ai: jest.Mocked<AiProviderPort>;

  beforeEach(async () => {
    ai = { complete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [VacancyParserService, { provide: AiProviderPort, useValue: ai }],
    }).compile();

    service = module.get(VacancyParserService);
  });

  // ─── RF-2.2 AC1 ───────────────────────────────────────────────────────────

  it('extrai tecnologias, senioridade e competências em vaga tech', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({
        technologies: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
        seniorityLevel: 'mid',
        keyCompetencies: ['APIs REST', 'revisão de código'],
        confidence: 'high',
        outOfScope: false,
      }),
    );

    const result = await service.parse(TECH_VACANCY);

    expect(result.technologies).toEqual(expect.arrayContaining(['Node.js', 'TypeScript']));
    expect(result.seniorityLevel).toBe('mid');
    expect(result.confidence).toBe('high');
    expect(result.outOfScope).toBe(false);
  });

  // ─── RF-2.2 AC3 — fallback genérico ──────────────────────────────────────

  it('retorna perfil genérico quando a IA lança erro', async () => {
    ai.complete.mockRejectedValue(new Error('timeout'));

    const result = await service.parse(TECH_VACANCY);

    expect(result.technologies).toEqual([]);
    expect(result.seniorityLevel).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.outOfScope).toBe(false);
  });

  it('retorna perfil genérico quando a IA retorna JSON inválido', async () => {
    ai.complete.mockResolvedValue('resposta em texto livre sem JSON');

    const result = await service.parse(TECH_VACANCY);

    expect(result.confidence).toBe('low');
    expect(result.technologies).toEqual([]);
  });

  it('usa .catch() do Zod e retorna confiança baixa para campos inválidos', async () => {
    // seniorityLevel inválido → AiResponseSchema faz .catch("unknown")
    ai.complete.mockResolvedValue(
      JSON.stringify({
        technologies: ['React'],
        seniorityLevel: 'ninja', // valor inválido
        keyCompetencies: [],
        confidence: 'high',
        outOfScope: false,
      }),
    );

    const result = await service.parse(TECH_VACANCY);

    expect(result.seniorityLevel).toBe('unknown');
    expect(result.technologies).toEqual(['React']);
  });

  // ─── edge case: out of scope ──────────────────────────────────────────────

  it('detecta vaga fora do escopo via heurística sem chamar a IA', async () => {
    const result = await service.parse(NON_TECH_VACANCY);

    expect(result.outOfScope).toBe(true);
    expect(result.confidence).toBe('low');
    expect(ai.complete.mock.calls).toHaveLength(0);
  });

  it('respeita outOfScope=true retornado pela IA', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({
        technologies: [],
        seniorityLevel: 'unknown',
        keyCompetencies: [],
        confidence: 'low',
        outOfScope: true,
      }),
    );

    const borderline = 'Profissional com experiência em software de gestão para área comercial.';
    const result = await service.parse(borderline);

    expect(result.outOfScope).toBe(true);
  });

  it('força confidence=low quando technologies está vazio', async () => {
    ai.complete.mockResolvedValue(
      JSON.stringify({
        technologies: [],
        seniorityLevel: 'junior',
        keyCompetencies: ['trabalho em equipe'],
        confidence: 'high', // IA diz high, mas sem tech → Zod transforma para low
        outOfScope: false,
      }),
    );

    const vague = 'Programador experiente necessário para empresa de tecnologia em crescimento.';
    const result = await service.parse(vague);

    expect(result.confidence).toBe('low');
  });
});
