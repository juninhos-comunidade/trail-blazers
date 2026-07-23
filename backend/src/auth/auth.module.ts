import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GithubStrategy } from './strategies/github.strategy';

@Module({
  controllers: [AuthController],
  providers: [AuthService, GithubStrategy],
  exports: [AuthService],
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'github' }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // o tipo do `expiresIn` é um template literal do `ms` (ex: '1d', '60s')
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
})
export class AuthModule {}
