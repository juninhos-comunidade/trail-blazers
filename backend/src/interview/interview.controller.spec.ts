import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InterviewController } from './interview.controller';
import { SessionsService } from './sessions.service';
import { CreateSessionSchema, SubmitAnswerSchema } from './schemas/interview.schema';

const USER_ID = 'user-abc';
const SESSION_ID = 'sessao-1';
const UUID = '3f640b37-def1-4aac-8aaa-18947a4b4a42';

const req = { user: { id: USER_ID, username: 'candidato' } } as never;

describe('InterviewController', () => {
  let controller: InterviewController;
  let sessions: Record<string, jest.Mock>;

  beforeEach(async () => {
    sessions = {
      create: jest.fn().mockResolvedValue({ id: SESSION_ID }),
      createWithProgress: jest.fn().mockResolvedValue({ id: SESSION_ID }),
      findMany: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: SESSION_ID }),
      submitAnswer: jest.fn().mockResolvedValue({ allAnswered: false }),
      generateReport: jest.fn().mockResolvedValue({ sessionId: SESSION_ID }),
      getReport: jest.fn().mockResolvedValue({ sessionId: SESSION_ID }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewController],
      providers: [{ provide: SessionsService, useValue: sessions }],
    }).compile();

    controller = module.get(InterviewController);
  });

  const makeRes = () => {
    const res: Record<string, jest.Mock> = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    res.setHeader.mockReturnValue(res);
    return res as unknown as { setHeader: jest.Mock; write: jest.Mock; end: jest.Mock };
  };

  it('CT-17.1 🔒 todo handler repassa o id do usuário autenticado ao service', async () => {
    const dto = { vacancyId: UUID, owner: 'candidato', repo: 'projeto', questionCount: 8 };
    const answer = { questionId: UUID, content: 'minha resposta' };
    const res = makeRes();

    await controller.create(req, dto, res as never);
    await controller.findAll(req);
    await controller.findOne(req, SESSION_ID);
    await controller.submitAnswer(req, SESSION_ID, answer);
    await controller.generateReport(req, SESSION_ID);
    await controller.getReport(req, SESSION_ID);
    await controller.remove(req, SESSION_ID);

    expect(sessions.createWithProgress).toHaveBeenCalledWith(USER_ID, dto, expect.any(Function));
    expect(sessions.findMany).toHaveBeenCalledWith(USER_ID);
    expect(sessions.findOne).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(sessions.submitAnswer).toHaveBeenCalledWith(USER_ID, SESSION_ID, answer);
    expect(sessions.generateReport).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(sessions.getReport).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(sessions.remove).toHaveBeenCalledWith(USER_ID, SESSION_ID);
  });

  it('CT-17.1b streama progresso e resultado em NDJSON e encerra a resposta', async () => {
    const dto = { vacancyId: UUID, owner: 'candidato', repo: 'projeto', questionCount: 8 };
    const res = makeRes();
    sessions.createWithProgress.mockImplementation(
      async (_userId: string, _dto: unknown, onProgress: (message: string) => void) => {
        onProgress('Buscando arquivos...');
        return { id: SESSION_ID };
      },
    );

    await controller.create(req, dto, res as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/x-ndjson; charset=utf-8',
    );
    expect(res.write).toHaveBeenCalledWith(
      `${JSON.stringify({ type: 'progress', message: 'Buscando arquivos...' })}\n`,
    );
    expect(res.write).toHaveBeenCalledWith(
      `${JSON.stringify({ type: 'result', session: { id: SESSION_ID } })}\n`,
    );
    expect(res.end).toHaveBeenCalled();
  });

  it('CT-17.1c streama um evento de erro quando o service falha', async () => {
    const dto = { vacancyId: UUID, owner: 'candidato', repo: 'projeto', questionCount: 8 };
    const res = makeRes();
    sessions.createWithProgress.mockRejectedValue(new NotFoundException('Vaga não encontrada.'));

    await controller.create(req, dto, res as never);

    const [[payload]] = res.write.mock.calls as [[string]];
    const event = JSON.parse(payload) as { type: string; status: number; message: string };

    expect(event.type).toBe('error');
    expect(event.status).toBe(404);
    expect(event.message).toBe('Vaga não encontrada.');
    expect(res.end).toHaveBeenCalled();
  });

  it('CT-17.2 devolve 404 quando o relatório ainda não existe', async () => {
    sessions.getReport.mockResolvedValue(null);

    await expect(controller.getReport(req, SESSION_ID)).rejects.toThrow(NotFoundException);
  });

  it('CT-17.2b devolve o relatório existente', async () => {
    await expect(controller.getReport(req, SESSION_ID)).resolves.toEqual({
      sessionId: SESSION_ID,
    });
  });

  it('CT-17.3 remove sem devolver corpo', async () => {
    await expect(controller.remove(req, SESSION_ID)).resolves.toBeUndefined();
  });

  describe('validação de entrada (UC-17)', () => {
    it('CT-17.8 rejeita vacancyId que não é UUID', () => {
      const result = CreateSessionSchema.safeParse({
        vacancyId: 'nao-e-uuid',
        owner: 'candidato',
        repo: 'projeto',
      });

      expect(result.success).toBe(false);
    });

    it('CT-17.9 aplica o default de 8 perguntas e rejeita fora da faixa 4–12', () => {
      const base = { vacancyId: UUID, owner: 'candidato', repo: 'projeto' };

      expect(CreateSessionSchema.parse(base).questionCount).toBe(8);
      expect(CreateSessionSchema.safeParse({ ...base, questionCount: 3 }).success).toBe(false);
      expect(CreateSessionSchema.safeParse({ ...base, questionCount: 13 }).success).toBe(false);
      expect(CreateSessionSchema.safeParse({ ...base, questionCount: 4.5 }).success).toBe(false);
    });

    it('CT-17.9b exige owner e repo não vazios', () => {
      expect(
        CreateSessionSchema.safeParse({ vacancyId: UUID, owner: '', repo: 'projeto' }).success,
      ).toBe(false);
      expect(
        CreateSessionSchema.safeParse({ vacancyId: UUID, owner: 'candidato', repo: '' }).success,
      ).toBe(false);
    });

    it('CT-17.10 rejeita resposta vazia ou acima de 5.000 caracteres', () => {
      expect(SubmitAnswerSchema.safeParse({ questionId: UUID, content: '' }).success).toBe(false);
      expect(
        SubmitAnswerSchema.safeParse({ questionId: UUID, content: 'a'.repeat(5001) }).success,
      ).toBe(false);
      expect(
        SubmitAnswerSchema.safeParse({ questionId: UUID, content: 'a'.repeat(5000) }).success,
      ).toBe(true);
    });
  });
});
