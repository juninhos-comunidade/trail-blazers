import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Request,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ZodValidationPipe } from '../vacancies/schemas/zod-validation.pipe';
import { SessionsService } from './sessions.service';
import {
  CreateSessionSchema,
  type CreateSessionDto,
  SubmitAnswerSchema,
  type SubmitAnswerDto,
} from './schemas/interview.schema';

/**
 * A criação de sessão passa por leitura do repositório inteiro + duas
 * chamadas de IA — pode levar dezenas de segundos. Em vez de um POST comum
 * (usuário só vê um spinner mudo), a resposta é um stream NDJSON: uma linha
 * por evento de progresso, terminando numa linha `result` ou `error`. Assim
 * o front pode mostrar exatamente o que está acontecendo em cada etapa.
 */
type StreamEvent =
  | { type: 'progress'; message: string }
  | { type: 'result'; session: unknown }
  | { type: 'error'; status: number; code?: string; message: string; retryable?: boolean };

@Controller('interview/sessions')
export class InterviewController {
  constructor(private readonly sessions: SessionsService) {}

  // Cada criação de sessão lê o repositório inteiro e faz duas chamadas de
  // IA — o limite geral do app não segura um script criando sessões em loop.
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post()
  async create(
    @Request() req: { user: AuthenticatedUser },
    @Body(new ZodValidationPipe(CreateSessionSchema)) dto: CreateSessionDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const write = (event: StreamEvent) => res.write(`${JSON.stringify(event)}\n`);

    try {
      const session = await this.sessions.createWithProgress(req.user.id, dto, (message) =>
        write({ type: 'progress', message }),
      );
      write({ type: 'result', session });
    } catch (err) {
      write(this.toErrorEvent(err));
    } finally {
      res.end();
    }
  }

  private toErrorEvent(err: unknown): StreamEvent {
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      const { code, message, retryable } =
        typeof body === 'string'
          ? { code: undefined, message: body, retryable: undefined }
          : (body as { code?: string; message?: string; retryable?: boolean });

      return { type: 'error', status, code, message: message ?? err.message, retryable };
    }

    return {
      type: 'error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno ao criar a sessão.',
    };
  }

  @Get()
  async findAll(@Request() req: { user: AuthenticatedUser }) {
    return this.sessions.findMany(req.user.id);
  }

  @Get(':id')
  async findOne(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.sessions.findOne(req.user.id, id);
  }

  @Post(':id/answers')
  @HttpCode(HttpStatus.CREATED)
  async submitAnswer(
    @Request() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SubmitAnswerSchema)) dto: SubmitAnswerDto,
  ) {
    return this.sessions.submitAnswer(req.user.id, id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post(':id/report')
  @HttpCode(HttpStatus.OK)
  async generateReport(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    return this.sessions.generateReport(req.user.id, id);
  }

  @Get(':id/report')
  async getReport(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    const report = await this.sessions.getReport(req.user.id, id);
    if (!report) throw new NotFoundException('Relatório ainda não gerado para esta sessão.');
    return report;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: { user: AuthenticatedUser }, @Param('id') id: string) {
    await this.sessions.remove(req.user.id, id);
  }
}
