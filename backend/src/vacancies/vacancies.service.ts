import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type Vacancy } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VacancyParseError, VacancyParserService } from './vacancy-parser.service';
import {
  type CreateVacancyDto,
  type UpdateVacancyProfileDto,
  type VacancyResponse,
  type ParsedVacancyProfile,
  type ParseStatus,
} from './schemas/vacancy.schema';

@Injectable()
export class VacanciesService {
  private readonly logger = new Logger(VacanciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: VacancyParserService,
  ) {}

  async create(userId: string, dto: CreateVacancyDto): Promise<VacancyResponse> {
    const vacancy = await this.prisma.vacancy.create({
      data: { userId, rawDescription: dto.description },
    });

    this.logger.log(`Vaga criada [id=${vacancy.id}] userId=${userId}`);

    void this.runParsing(vacancy.id, dto.description);

    return this.toResponse(vacancy);
  }

  async findOne(id: string, userId: string): Promise<VacancyResponse> {
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id, userId } });
    if (!vacancy) throw new NotFoundException('Vaga não encontrada.');
    return this.toResponse(vacancy);
  }

  async reparse(id: string, userId: string): Promise<VacancyResponse> {
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id, userId } });
    if (!vacancy) throw new NotFoundException('Vaga não encontrada.');

    if (vacancy.parseStatus === 'pending') {
      throw new ConflictException('A análise desta vaga ainda está em andamento.');
    }

    const reset = await this.prisma.vacancy.update({
      where: { id },
      data: {
        parseStatus: 'pending',
        parseFailureReason: null,
        parsedStack: Prisma.DbNull,
        parsedSeniority: null,
        parsedSkills: Prisma.DbNull,
        parseConfidence: null,
        parsedOutOfScope: null,
      },
    });

    this.logger.log(`Reanálise solicitada [id=${id}] userId=${userId}`);

    void this.runParsing(id, vacancy.rawDescription);

    return this.toResponse(reset);
  }

  async updateProfile(
    id: string,
    userId: string,
    dto: UpdateVacancyProfileDto,
  ): Promise<VacancyResponse> {
    const vacancy = await this.prisma.vacancy.findFirst({ where: { id, userId } });
    if (!vacancy) throw new NotFoundException('Vaga não encontrada.');

    if (vacancy.parseStatus !== 'done') {
      throw new ConflictException('Esta vaga ainda não tem uma análise para editar.');
    }

    const usedInSession = await this.prisma.session.findFirst({ where: { vacancyId: id } });
    if (usedInSession) {
      throw new ConflictException('Esta etapa já foi concluída e não pode mais ser ajustada.');
    }

    const updated = await this.prisma.vacancy.update({
      where: { id },
      data: {
        parsedStack: dto.technologies,
        parsedSeniority: dto.seniorityLevel,
        parsedSkills: dto.keyCompetencies,
      },
    });

    this.logger.log(`Perfil editado manualmente [id=${id}] userId=${userId}`);

    return this.toResponse(updated);
  }

  async findAllByUser(userId: string): Promise<VacancyResponse[]> {
    const vacancies = await this.prisma.vacancy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return vacancies.map((v) => this.toResponse(v));
  }

  private async runParsing(id: string, description: string): Promise<void> {
    this.logger.log(`Parsing iniciado [id=${id}]`);

    let parsed: ParsedVacancyProfile;
    try {
      parsed = await this.parser.parse(description);
    } catch (err) {
      const reason = err instanceof VacancyParseError ? err.reason : 'unknown';
      this.logger.error(`Parsing falhou [id=${id}] reason=${reason}`, err);
      await this.persistFailure(id, reason);
      return;
    }

    try {
      await this.persistProfile(id, parsed);
    } catch (err) {
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
        parseStatus: 'done',
        parseFailureReason: null,
      },
    });
  }

  private async persistFailure(id: string, reason: string): Promise<void> {
    try {
      await this.prisma.vacancy.update({
        where: { id },
        data: { parseStatus: 'failed', parseFailureReason: reason },
      });
    } catch (err) {
      this.logger.error(`Falha ao gravar o status de erro [id=${id}]`, err);
    }
  }

  private toResponse(v: Vacancy): VacancyResponse {
    const parseStatus: ParseStatus = v.parseStatus;

    const parsedProfile: ParsedVacancyProfile | null =
      parseStatus === 'done'
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
      parseStatus,
      parseFailureReason: v.parseFailureReason,
      parsingCompleted: parseStatus !== 'pending',
      createdAt: v.createdAt,
    };
  }
}
