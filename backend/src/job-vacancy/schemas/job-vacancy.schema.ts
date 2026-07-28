import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const VACANCY_MIN_LENGTH = 50;
export const VACANCY_MAX_LENGTH = 10_000;

// ─── Enums ───────────────────────────────────────────────────────────────────

export const SeniorityLevelSchema = z.enum([
  'junior',
  'mid',
  'senior',
  'lead',
  'unknown',
]);

export const ParsingConfidenceSchema = z.enum(['high', 'low']);

export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;
export type ParsingConfidence = z.infer<typeof ParsingConfidenceSchema>;

// ─── ParsedVacancyProfile ────────────────────────────────────────────────────

export const ParsedVacancyProfileSchema = z.object({
  technologies: z.array(z.string()),
  seniorityLevel: SeniorityLevelSchema,
  keyCompetencies: z.array(z.string()),
  confidence: ParsingConfidenceSchema,
  outOfScope: z.boolean(),
});

export type ParsedVacancyProfile = z.infer<typeof ParsedVacancyProfileSchema>;

// ─── Schema que a IA deve retornar (com coerção + defaults) ─────────────────

export const AiResponseSchema = z
  .object({
    technologies: z.array(z.string()).max(15).default([]),
    seniorityLevel: SeniorityLevelSchema.catch('unknown'),
    keyCompetencies: z.array(z.string()).max(10).default([]),
    confidence: ParsingConfidenceSchema.default('high'),
    outOfScope: z.boolean().default(false),
  })
  .transform((data) => ({
    ...data,
    // Se a IA não identificou tecnologias, forçamos confiança baixa
    confidence: data.technologies.length === 0 ? 'low' as const : data.confidence,
  }));

// ─── DTO de entrada ──────────────────────────────────────────────────────────

export const CreateJobVacancySchema = z.object({
  description: z
    .string({ required_error: 'A descrição da vaga é obrigatória.' })
    .min(
      VACANCY_MIN_LENGTH,
      `A descrição deve ter ao menos ${VACANCY_MIN_LENGTH} caracteres.`,
    )
    .max(
      VACANCY_MAX_LENGTH,
      `A descrição não pode exceder ${VACANCY_MAX_LENGTH} caracteres.`,
    )
    .transform((val) => val.trim()),
});

export type CreateJobVacancyDto = z.infer<typeof CreateJobVacancySchema>;

// ─── Tipo de resposta (espelho do modelo Prisma + parsedProfile tipado) ──────

export interface JobVacancyResponse {
  id: string;
  userId: string;
  description: string;
  parsedProfile: ParsedVacancyProfile | null;
  parsingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
