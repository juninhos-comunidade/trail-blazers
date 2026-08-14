import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './crypto/crypto.module';
import { RepositoriesModule } from './repos/repos.module';
import { VacanciesModule } from './vacancies/vacancies.module';
import { AiModule } from './ai/ai.module';
import { InterviewModule } from './interview/interview.module';
import { TtsModule } from './tts/tts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    // Limite geral por IP. Endpoints que disparam chamadas de IA (pagas) têm
    // um limite bem mais apertado via @Throttle nos próprios controllers.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CryptoModule,
    UsersModule,
    AuthModule,
    RepositoriesModule,
    VacanciesModule,
    AiModule,
    InterviewModule,
    TtsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
