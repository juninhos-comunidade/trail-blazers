import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

describe('TtsController', () => {
  let controller: TtsController;
  let service: { synthesize: jest.Mock };

  beforeEach(async () => {
    service = { synthesize: jest.fn().mockResolvedValue(Buffer.from([1, 2, 3])) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TtsController],
      providers: [{ provide: TtsService, useValue: service }],
    }).compile();

    controller = module.get(TtsController);
  });

  it('CT-16.10 devolve o áudio como StreamableFile', async () => {
    const result = await controller.speak({ text: 'qual sua experiência?' });

    expect(result).toBeInstanceOf(StreamableFile);
    expect(service.synthesize).toHaveBeenCalledWith('qual sua experiência?');
  });

  it('CT-16.10b anuncia audio/mpeg no header da rota', () => {
    const handler = Object.getOwnPropertyDescriptor(TtsController.prototype, 'speak')
      ?.value as object;
    const headers = Reflect.getMetadata('__headers__', handler) as {
      name: string;
      value: string;
    }[];

    expect(headers).toContainEqual({ name: 'Content-Type', value: 'audio/mpeg' });
  });
});
