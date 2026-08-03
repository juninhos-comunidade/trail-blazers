import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Vacancy } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VacancyParserService } from './vacancy-parser.service';
import {
  type CreateVacancyDto,
  type VacancyResponse,
  type ParsedVacancyProfile,
} from './schemas/vacancy.schema';

// perfil gravado quando o parsing falha de forma irrecuperável — existe para o
// polling do front terminar em vez de girar para sempre
const FAILED_PROFILE: ParsedVacancyProfile = {
  technologies: [],
  seniorityLevel: 'unknown',
  keyCompetencies: [],
  confidence: 'low',
  outOfScope: false,
};

@Injectable()
export class VacanciesService {
  private readonly logger = new Logger(VacanciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: VacancyParserService,
  ) {}

  // ─── RF-2.1 + RF-2.2 ───────────────────────────────────────────────────

  async create(userId: string, dto: CreateVacancyDto): Promise<VacancyResponse> {
    // o tamanho já foi validado pelo ZodValidationPipe
    const vacancy = await this.prisma.vacancy.create({
      data: { userId, rawDescription: dto.description },
    });

    this.logger.log(`Vaga criada [id=${vacancy.id}] userId=${userId}`);

    // dispara sem aguardar: o 201 volta na hora e o parsing roda em background
    void this.runParsing(vacancy.id, dto.description);

    return this.toResponse(vacancy);
  }

  async findOne(id: string, userId: string): Promise<VacancyResponse> {
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id, userId } });
    if (!vacancy) throw new NotFoundException('Vaga não encontrada.');
    return this.toResponse(vacancy);
  }

  async findAllByUser(userId: string): Promise<VacancyResponse[]> {
    const vacancies = await this.prisma.vacancy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return vacancies.map((v) => this.toResponse(v));
  }

  // ─── parsing ────────────────────────────────────────────────────────────

  private async runParsing(id: string, description: string): Promise<void> {
    this.logger.log(`Parsing iniciado [id=${id}]`);

    let parsed: ParsedVacancyProfile;
    try {
      parsed = await this.parser.parse(description);
    } catch (err) {
      // o parser já trata as falhas esperadas; isto aqui é a rede de segurança
      this.logger.error(`Parsing falhou [id=${id}] — gravando perfil vazio`, err);
      parsed = FAILED_PROFILE;
    }

    try {
      await this.persistProfile(id, parsed);
    } catch (err) {
      // sem isto, a vaga fica presa em "processando" e o front faz polling infinito
      this.logger.error(`Falha ao gravar o perfil [id=${id}]`, err);
      return;
    }

    this.logger.log(
      `Parsing concluído [id=${id}] confidence=${parsed.confidence} outOfScope=${parsed.outOfScope}`,
    );
  }

  private async persistProfile(id: string, parsed: ParsedVacancyProfile): Promise<void> {
    await this.prisma.vacancy.update({
      where: { id },
      data: {
        parsedStack: parsed.technologies,
        parsedSeniority: parsed.seniorityLevel,
        parsedSkills: parsed.keyCompetencies,
        parseConfidence: parsed.confidence === 'high' ? 1.0 : 0.5,
        parsedOutOfScope: parsed.outOfScope,
      },
    });
  }

  // ─── mapper ─────────────────────────────────────────────────────────────

  private toResponse(v: Vacancy): VacancyResponse {
    const parsingCompleted = v.parseConfidence !== null;

    const parsedProfile: ParsedVacancyProfile | null = parsingCompleted
      ? {
          technologies: (v.parsedStack ?? []) as string[],
          seniorityLevel: (v.parsedSeniority ??
            'unknown') as ParsedVacancyProfile['seniorityLevel'],
          keyCompetencies: (v.parsedSkills ?? []) as string[],
          confidence: v.parseConfidence === 1.0 ? 'high' : 'low',
          outOfScope: v.parsedOutOfScope ?? false,
        }
      : null;

    return {
      id: v.id,
      userId: v.userId,
      rawDescription: v.rawDescription,
      parsedProfile,
      parsingCompleted,
      createdAt: v.createdAt,
    };
  }
}
