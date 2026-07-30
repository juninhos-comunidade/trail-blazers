import { Controller, Post, Body, Headers } from '@nestjs/common';
import { VacanciesService } from './vacancies.service';
import { CreateVacancyDto } from './dto/create-vacancy.dto';

@Controller('vacancies')
export class VacanciesController {
  constructor(private readonly vacanciesService: VacanciesService) {}

  @Post()
  create(
    @Body() createVacancyDto: CreateVacancyDto,
    @Headers('authorization') authorization: string,
  ) {
    const githubToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : authorization;
    return this.vacanciesService.create(createVacancyDto, githubToken);
  }
}
