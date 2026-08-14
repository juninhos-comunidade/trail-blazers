import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 24 * 60 * 60 * 1000,
      max: 200,
    }),
  ],
  controllers: [TtsController],
  providers: [TtsService],
})
export class TtsModule {}
