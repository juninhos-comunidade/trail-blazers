import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { RepositoriesService } from './repos.service';
import { RepositorySummary } from './types/repos-summary';

@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @Get()
  async list(@Req() req: Request): Promise<RepositorySummary[]> {
    const user = req.user as AuthenticatedUser;
    return this.repositoriesService.listForUser(user.id);
  }
}
