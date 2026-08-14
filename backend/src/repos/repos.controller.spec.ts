import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { RepositoriesController } from './repos.controller';
import { RepositoriesService } from './repos.service';

const USER_ID = 'user-abc';

const req = { user: { id: USER_ID, username: 'candidato' } } as unknown as Request;

describe('RepositoriesController', () => {
  let controller: RepositoriesController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      listForUser: jest.fn().mockResolvedValue([]),
      analyzeRepositoryContent: jest.fn().mockResolvedValue({
        relevantFiles: [],
        omittedFiles: [],
        totalTokensEstimative: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [{ provide: RepositoriesService, useValue: service }],
    }).compile();

    controller = module.get(RepositoriesController);
  });

  it('CT-17.7 🔒 lista os repositórios do usuário autenticado', async () => {
    service.listForUser.mockResolvedValue([{ id: 1, name: 'projeto' }]);

    const result = await controller.list(req);

    expect(service.listForUser).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual([{ id: 1, name: 'projeto' }]);
  });

  it('CT-17.7b 🔒 repassa usuário, owner, repo e vacancyId para a análise', async () => {
    await controller.analyze(req, 'candidato', 'meu-projeto', 'vaga-1');

    expect(service.analyzeRepositoryContent).toHaveBeenCalledWith(
      USER_ID,
      'candidato',
      'meu-projeto',
      'vaga-1',
    );
  });

  it('CT-17.7c repassa vacancyId ausente para o service decidir', async () => {
    await controller.analyze(req, 'candidato', 'meu-projeto', undefined as unknown as string);

    expect(service.analyzeRepositoryContent).toHaveBeenCalledWith(
      USER_ID,
      'candidato',
      'meu-projeto',
      undefined,
    );
  });
});
