import { Test, TestingModule } from '@nestjs/testing';
import { VacanciesController } from './vacancies.controller';
import { VacanciesService } from './vacancies.service';
import { UpdateVacancyProfileSchema, VACANCY_MIN_LENGTH } from './schemas/vacancy.schema';

const USER_ID = 'user-abc';
const VACANCY_ID = 'vaga-1';

const req = { user: { id: USER_ID, username: 'candidato' } } as never;

describe('VacanciesController', () => {
  let controller: VacanciesController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: VACANCY_ID }),
      findOne: jest.fn().mockResolvedValue({ id: VACANCY_ID }),
      reparse: jest.fn().mockResolvedValue({ id: VACANCY_ID }),
      findAllByUser: jest.fn().mockResolvedValue([]),
      updateProfile: jest.fn().mockResolvedValue({ id: VACANCY_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VacanciesController],
      providers: [{ provide: VacanciesService, useValue: service }],
    }).compile();

    controller = module.get(VacanciesController);
  });

  it('CT-17.5 🔒 todo handler repassa o id do usuário autenticado ao service', async () => {
    const dto = { description: 'a'.repeat(VACANCY_MIN_LENGTH + 1) };
    const profile = {
      technologies: ['Node.js'],
      seniorityLevel: 'mid' as const,
      keyCompetencies: ['APIs REST'],
    };

    await controller.create(req, dto);
    await controller.findOne(req, VACANCY_ID);
    await controller.reparse(req, VACANCY_ID);
    await controller.findAll(req);
    await controller.updateProfile(req, VACANCY_ID, profile);

    expect(service.create).toHaveBeenCalledWith(USER_ID, dto);
    expect(service.findOne).toHaveBeenCalledWith(VACANCY_ID, USER_ID);
    expect(service.reparse).toHaveBeenCalledWith(VACANCY_ID, USER_ID);
    expect(service.findAllByUser).toHaveBeenCalledWith(USER_ID);
    expect(service.updateProfile).toHaveBeenCalledWith(VACANCY_ID, USER_ID, profile);
  });

  it('CT-17.6 devolve ao cliente o que o service produziu', async () => {
    service.findAllByUser.mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]);

    await expect(controller.findAll(req)).resolves.toHaveLength(2);
    await expect(controller.findOne(req, VACANCY_ID)).resolves.toEqual({ id: VACANCY_ID });
  });

  describe('UpdateVacancyProfileSchema (UC-18)', () => {
    const valid = {
      technologies: ['Node.js'],
      seniorityLevel: 'mid',
      keyCompetencies: ['APIs REST'],
    };

    it('CT-17.6b aceita um perfil válido', () => {
      expect(UpdateVacancyProfileSchema.safeParse(valid).success).toBe(true);
    });

    it.each([
      ['mais de 15 tecnologias', { technologies: Array.from({ length: 16 }, (_, i) => `t${i}`) }],
      [
        'mais de 10 competências',
        { keyCompetencies: Array.from({ length: 11 }, (_, i) => `c${i}`) },
      ],
      ['tecnologia vazia', { technologies: [''] }],
      ['senioridade inválida', { seniorityLevel: 'guru' }],
    ])('CT-17.6c rejeita perfil com %s', (_caso, overrides) => {
      expect(UpdateVacancyProfileSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
    });
  });
});
