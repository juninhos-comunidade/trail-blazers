import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RepositoriesController } from './repos.controller';
import { RepositoriesService } from './repos.service';

@Module({
  imports: [UsersModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
})
export class RepositoriesModule {}
