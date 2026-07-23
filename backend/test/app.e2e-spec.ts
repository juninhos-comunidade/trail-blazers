import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // a rota agora é protegida pelo JwtAuthGuard global; o caminho autenticado
  // está coberto em auth.e2e-spec.ts (CT-05.2)
  it('/ (GET) exige autenticação', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
