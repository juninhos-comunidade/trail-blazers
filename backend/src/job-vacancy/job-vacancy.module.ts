import { Module } from '@nestjs/common';
import { JobVacancyService } from './job-vacancy.service';
import { JobVacancyController } from './job-vacancy.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [JobVacancyService],
  controllers: [JobVacancyController],
  exports: [JobVacancyService],
})
export class JobVacancyModule {}
