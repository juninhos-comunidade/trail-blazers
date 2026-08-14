import { Body, Controller, Header, Post, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TtsService } from './tts.service';
import { SpeakSchema, type SpeakDto } from './tts.schema';
import { ZodValidationPipe } from '../vacancies/schemas/zod-validation.pipe';

@Controller('tts')
export class TtsController {
  constructor(private readonly service: TtsService) {}

  // O tier gratuito da Azure Speech só aceita 1 requisição concorrente —
  // sem limite aqui, um script derruba a voz para todo mundo, não só o custo.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('speak')
  @Header('Content-Type', 'audio/mpeg')
  async speak(@Body(new ZodValidationPipe(SpeakSchema)) dto: SpeakDto): Promise<StreamableFile> {
    const audio = await this.service.synthesize(dto.text);
    return new StreamableFile(audio);
  }
}
