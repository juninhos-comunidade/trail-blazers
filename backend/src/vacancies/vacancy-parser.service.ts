import { Injectable, Logger } from '@nestjs/common';
import { AiResponseSchema, ParsedVacancyProfile } from './schemas/vacancy.schema';

export abstract class AiProviderPort {
  abstract complete(systemPrompt: string, userMessage: string): Promise<string>;
}

/** O que deu errado na conversa com o provedor de IA. */
export type AiErrorKind = 'invalid_api_key' | 'timeout' | 'unavailable';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Motivo pelo qual a análise não pôde ser feita. Não confundir com um resultado
 * pobre: uma vaga vaga demais gera um perfil vazio, mas a análise deu certo.
 */
export type ParseFailureReason =
  'invalid_api_key' | 'timeout' | 'ai_unavailable' | 'invalid_response';

const AI_ERROR_TO_REASON: Record<AiErrorKind, ParseFailureReason> = {
  invalid_api_key: 'invalid_api_key',
  timeout: 'timeout',
  unavailable: 'ai_unavailable',
};

export class VacancyParseError extends Error {
  constructor(
    readonly reason: ParseFailureReason,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'VacancyParseError';
  }
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

const OUT_OF_SCOPE_PROFILE: ParsedVacancyProfile = {
  technologies: [],
  seniorityLevel: 'unknown',
  keyCompetencies: [],
  confidence: 'low',
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
      this.logger.error('Falha na chamada à IA.', err);

      const reason = err instanceof AiError ? AI_ERROR_TO_REASON[err.kind] : 'ai_unavailable';
      const message = err instanceof AiError ? err.message : 'A chamada à IA não foi concluída.';

      throw new VacancyParseError(reason, message, err);
    }

    return this.parseWithZod(raw);
  }

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
      throw new VacancyParseError('invalid_response', 'A IA não devolveu um JSON válido.');
    }

    const result = AiResponseSchema.safeParse(json);
    if (!result.success) {
      this.logger.error('Resposta da IA não passou na validação Zod.', result.error.flatten());
      throw new VacancyParseError(
        'invalid_response',
        'A resposta da IA não bate com o formato esperado.',
        result.error.flatten(),
      );
    }

    const data = result.data;

    if (data.outOfScope) return OUT_OF_SCOPE_PROFILE;

    return data;
  }

  private quickScopeCheck(text: string): boolean {
    const lower = text.toLowerCase();
    return TECH_SCOPE_KEYWORDS.some((kw) => SCOPE_PATTERNS[kw].test(lower));
  }
}
