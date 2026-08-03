import { Controller, Post, Get, Param, Body, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { VacanciesService } from './vacancies.service';
import { type CreateVacancyDto, CreateVacancySchema } from './schemas/vacancy.schema';
import { ZodValidationPipe } from './schemas/zod-validation.pipe';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

// o JwtAuthGuard já está registrado como APP_GUARD em auth.module.ts
@Controller('vacancies')
export class VacanciesController {
  constructor(private readonly service: VacanciesService) {}

  /**
   * POST /vacancies
   * RF-2.1 + RF-2.2: cadastra a vaga e dispara parsing.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateVacancySchema)) dto: CreateVacancyDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  /**
   * GET /vacancies/:id
   * Polling para verificar parsingCompleted e obter parsedProfile.
   */
  @Get(':id')
  async findOne(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.service.findOne(id, req.user.id);
  }

  /**
   * GET /vacancies
   * RF-2.3 (Could): lista vagas anteriores do candidato.
   */
  @Get()
  async findAll(@Request() req: { user: AuthenticatedUser }) {
    return this.service.findAllByUser(req.user.id);
  }
}
