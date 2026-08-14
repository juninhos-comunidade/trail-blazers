import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

@Module({
  imports: [
    // Texto igual sempre gera o mesmo áudio (voz fixa, configurada no
    // servidor) — cache de 24h é seguro e evita gastar a cota da Azure
    // (0,5M caracteres/mês no tier F0) repetindo a mesma síntese.
    CacheModule.register({
      ttl: 24 * 60 * 60 * 1000,
      max: 200,
    }),
  ],
  controllers: [TtsController],
  providers: [TtsService],
})
export class TtsModule {}
