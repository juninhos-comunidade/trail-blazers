import { Body, Controller, Header, Post, StreamableFile } from '@nestjs/common';
import { TtsService } from './tts.service';
import { SpeakSchema, type SpeakDto } from './tts.schema';
import { ZodValidationPipe } from '../vacancies/schemas/zod-validation.pipe';

@Controller('tts')
export class TtsController {
  constructor(private readonly service: TtsService) {}

  @Post('speak')
  @Header('Content-Type', 'audio/mpeg')
  async speak(
    @Body(new ZodValidationPipe(SpeakSchema)) dto: SpeakDto,
  ): Promise<StreamableFile> {
    const audio = await this.service.synthesize(dto.text);
    return new StreamableFile(audio);
  }
}
