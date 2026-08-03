import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JobVacancyService } from './job-vacancy.service';
import { type CreateJobVacancyDto, CreateJobVacancySchema } from './schemas/job-vacancy.schema';
import { ZodValidationPipe } from './schemas/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('job-vacancies')
@UseGuards(JwtAuthGuard)
export class JobVacancyController {
  constructor(private readonly service: JobVacancyService) {}

  /**
   * POST /job-vacancies
   * RF-2.1 + RF-2.2: cadastra a vaga e dispara parsing.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateJobVacancySchema)) dto: CreateJobVacancyDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  /**
   * GET /job-vacancies/:id
   * Polling para verificar parsingCompleted e obter parsedProfile.
   */
  @Get(':id')
  async findOne(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.service.findOne(id, req.user.id);
  }

  /**
   * GET /job-vacancies
   * RF-2.3 (Could): lista vagas anteriores do candidato.
   */
  @Get()
  async findAll(@Request() req: { user: AuthenticatedUser }) {
    return this.service.findAllByUser(req.user.id);
  }
}
