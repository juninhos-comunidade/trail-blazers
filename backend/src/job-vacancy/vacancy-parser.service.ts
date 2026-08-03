import { Injectable, Logger } from '@nestjs/common';
import {
  AiResponseSchema,
  ParsedVacancyProfile,
} from '../job-vacancy/schemas/job-vacancy.schema';

export abstract class AiProviderPort {
  abstract complete(systemPrompt: string, userMessage: string): Promise<string>;
}

const TECH_SCOPE_KEYWORDS = [
  'desenvolvedor', 'developer', 'engenheiro', 'engineer', 'software', 'backend',
  'frontend', 'fullstack', 'devops', 'cloud', 'mobile', 'data', 'ml', 'ia', 'ai',
  'react', 'node', 'python', 'java', 'typescript', 'javascript', 'golang', 'rust',
  'kubernetes', 'docker', 'aws', 'api', 'microservices', 'banco de dados', 'database',
];

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

  private parseWithZod(raw: string): ParsedVacancyProfile {
    let json: unknown;
    try {
      json = JSON.parse(raw.trim());
    } catch {
      this.logger.error('Resposta da IA não é JSON válido.', raw.slice(0, 200));
      return GENERIC_PROFILE;
    }

    const result = AiResponseSchema.safeParse(json);
    if (!result.success) {
      this.logger.error(
        'Resposta da IA não passou na validação Zod.',
        result.error.flatten(),
      );
      return GENERIC_PROFILE;
    }

    const data = result.data;

    // Edge case: IA indicou fora do escopo
    if (data.outOfScope) return OUT_OF_SCOPE_PROFILE;

    return data as ParsedVacancyProfile;
  }

  private quickScopeCheck(text: string): boolean {
    const lower = text.toLowerCase();
    return TECH_SCOPE_KEYWORDS.some((kw) => lower.includes(kw));
  }
}
