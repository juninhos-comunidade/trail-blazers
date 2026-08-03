import { Injectable, Logger } from '@nestjs/common';
import { AiResponseSchema, ParsedVacancyProfile } from './schemas/vacancy.schema';

export abstract class AiProviderPort {
  abstract complete(systemPrompt: string, userMessage: string): Promise<string>;
}

const TECH_SCOPE_KEYWORDS = [
  'desenvolvedor',
  'desenvolvedora',
  'developer',
  'engenheiro',
  'engenheira',
  'engineer',
  'software',
  'backend',
  'back-end',
  'frontend',
  'front-end',
  'fullstack',
  'full-stack',
  'devops',
  'cloud',
  'mobile',
  'data',
  'machine learning',
  'inteligência artificial',
  'react',
  'node',
  'python',
  'java',
  'typescript',
  'javascript',
  'golang',
  'rust',
  'kubernetes',
  'docker',
  'aws',
  'api',
  'microservices',
  'microsserviços',
  'banco de dados',
  'database',
  'programação',
  'programador',
  'programadora',
];

// pré-compilado uma vez: a regex é criada no boot, não a cada requisição
const SCOPE_PATTERNS: Record<string, RegExp> = Object.fromEntries(
  TECH_SCOPE_KEYWORDS.map((kw) => [
    kw,
    new RegExp(
      `(?<![\\p{L}\\p{N}])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`,
      'iu',
    ),
  ]),
);

const PARSE_SYSTEM_PROMPT = `
Você é um especialista em análise de vagas de tecnologia.
Analise a descrição de vaga fornecida e responda APENAS com um objeto JSON válido, sem markdown, sem texto adicional.

Schema obrigatório:
{
  "technologies": string[],        // linguagens, frameworks e ferramentas (máx. 15)
  "seniorityLevel": "junior" | "mid" | "senior" | "lead" | "unknown",
  "keyCompetencies": string[],     // habilidades e requisitos-chave (máx. 10)
  "confidence": "high" | "low",   // "low" se a stack não ficou clara
  "outOfScope": boolean            // true se a vaga não for de tecnologia
}

Regras:
- Normalize nomes: "nodejs" → "Node.js", "reactjs" → "React".
- Se não houver tecnologias claras, use [] e "confidence": "low".
- Se a vaga não for de tecnologia, retorne "outOfScope": true.
`.trim();

const GENERIC_PROFILE: ParsedVacancyProfile = {
  technologies: [],
  seniorityLevel: 'unknown',
  keyCompetencies: [],
  confidence: 'low',
  outOfScope: false,
};

const OUT_OF_SCOPE_PROFILE: ParsedVacancyProfile = {
  ...GENERIC_PROFILE,
  outOfScope: true,
};

@Injectable()
export class VacancyParserService {
  private readonly logger = new Logger(VacancyParserService.name);

  constructor(private readonly ai: AiProviderPort) {}

  async parse(description: string): Promise<ParsedVacancyProfile> {
    if (!this.quickScopeCheck(description)) {
      this.logger.warn('Heurística: descrição fora do escopo tech.');
      return OUT_OF_SCOPE_PROFILE;
    }

    let raw: string;
    try {
      raw = await this.ai.complete(PARSE_SYSTEM_PROMPT, description);
    } catch (err) {
      this.logger.error('Falha na chamada à IA — usando perfil genérico.', err);
      return GENERIC_PROFILE;
    }

    return this.parseWithZod(raw);
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  /**
   * Modelos menores costumam ignorar `response_format: json_object` e devolver o
   * JSON embrulhado em cerca markdown. Sem esta limpeza o JSON.parse falha e o
   * parsing inteiro cai no perfil genérico silenciosamente.
   */
  private stripMarkdownFence(raw: string): string {
    return raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  private parseWithZod(raw: string): ParsedVacancyProfile {
    let json: unknown;
    try {
      json = JSON.parse(this.stripMarkdownFence(raw));
    } catch {
      this.logger.error('Resposta da IA não é JSON válido.', raw.slice(0, 200));
      return GENERIC_PROFILE;
    }

    const result = AiResponseSchema.safeParse(json);
    if (!result.success) {
      this.logger.error('Resposta da IA não passou na validação Zod.', result.error.flatten());
      return GENERIC_PROFILE;
    }

    const data = result.data;

    // Edge case: IA indicou fora do escopo
    if (data.outOfScope) return OUT_OF_SCOPE_PROFILE;

    return data;
  }

  /**
   * Filtro barato antes de gastar uma chamada de IA. Usa fronteira de palavra:
   * com `includes()` puro, "ia" casava com "experiência" e "ai" com "mais", o
   * que fazia qualquer texto em português passar.
   */
  private quickScopeCheck(text: string): boolean {
    const lower = text.toLowerCase();
    return TECH_SCOPE_KEYWORDS.some((kw) => SCOPE_PATTERNS[kw].test(lower));
  }
}
