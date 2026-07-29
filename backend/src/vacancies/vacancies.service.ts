import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVacancyDto } from './dto/create-vacancy.dto';

@Injectable()
export class VacanciesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createVacancyDto: CreateVacancyDto, githubToken: string) {
    return this.prisma.vacancy.create({
      data: {
        description: createVacancyDto.description,
        githubToken,
      },
    });
  }
}
