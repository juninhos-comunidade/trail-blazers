import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VacancyParserService } from './vacancy-parser.service';
import {
  type CreateJobVacancyDto,
  type JobVacancyResponse,
  type ParsedVacancyProfile,
  VACANCY_MAX_LENGTH,
} from './schemas/job-vacancy.schema';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

@Injectable()
export class JobVacancyService {
  private readonly logger = new Logger(JobVacancyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: VacancyParserService,
  ) {}

  // ─── RF-2.1 + RF-2.2 ───────────────────────────────────────────────────

  async create(userId: string, dto: CreateJobVacancyDto): Promise<JobVacancyResponse> {
    const description = dto.description.slice(0, VACANCY_MAX_LENGTH);

    const job = await this.prisma.job.create({
      data: { userId, rawDescription: description },
    });

    this.logger.log(`Vaga criada [id=${job.id}] userId=${userId}`);

    this.runParsing(job.id, description).catch((err) =>
      this.logger.error(`Parsing falhou [id=${job.id}]`, err),
    );

    return this.toResponse(job);
  }

  async findOne(id: string, userId: string): Promise<JobVacancyResponse> {
    const job = await this.prisma.job.findFirst({ where: { id, userId } });
    if (!job) throw new NotFoundException('Vaga não encontrada.');
    return this.toResponse(job);
  }

  async findAllByUser(userId: string): Promise<JobVacancyResponse[]> {
    const jobs = await this.prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return jobs.map((j) => this.toResponse(j));
  }

  // ─── parsing ────────────────────────────────────────────────────────────

  private async runParsing(id: string, description: string): Promise<void> {
    this.logger.log(`Parsing iniciado [id=${id}]`);

    const parsed = await this.parser.parse(description);

    await this.prisma.job.update({
      where: { id },
      data: {
        parsedStack: parsed.technologies,
        parsedSeniority: parsed.seniorityLevel,
        parsedSkills: parsed.keyCompetencies,
        parseConfidence: parsed.confidence === 'high' ? 1.0 : 0.5,
      },
    });

    this.logger.log(
      `Parsing concluído [id=${id}] confidence=${parsed.confidence} outOfScope=${parsed.outOfScope}`,
    );
  }

  // ─── mapper ─────────────────────────────────────────────────────────────

  private toResponse(j: {
    id: string;
    userId: string;
    rawDescription: string;
    parsedStack: JsonValue | null;
    parsedSeniority: string | null;
    parsedSkills: JsonValue | null;
    parseConfidence: number | null;
    createdAt: Date;
  }): JobVacancyResponse {
    const parsingCompleted = j.parseConfidence !== null;

    const parsedProfile: ParsedVacancyProfile | null = parsingCompleted
      ? {
          technologies: j.parsedStack as string[],
          seniorityLevel: j.parsedSeniority as ParsedVacancyProfile['seniorityLevel'],
          keyCompetencies: j.parsedSkills as string[],
          confidence: j.parseConfidence === 1.0 ? 'high' : 'low',
          outOfScope: false,
        }
      : null;

    return {
      id: j.id,
      userId: j.userId,
      description: j.rawDescription,
      parsedProfile,
      parsingCompleted,
      createdAt: j.createdAt,
      updatedAt: j.createdAt,
    };
  }
}
