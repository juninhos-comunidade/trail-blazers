import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe';
import {
  CreateJobVacancySchema,
  VACANCY_MIN_LENGTH,
  VACANCY_MAX_LENGTH,
} from './job-vacancy.schema';

const pipe = new ZodValidationPipe(CreateJobVacancySchema);
const meta = { type: 'body', metatype: Object, data: '' } as any;

const valid = 'a'.repeat(VACANCY_MIN_LENGTH + 5);

describe('ZodValidationPipe — CreateJobVacancySchema', () => {
  // ─── RF-2.1 AC2 — mínimo ─────────────────────────────────────────────────

  it('lança BadRequestException quando descrição está vazia', () => {
    expect(() => pipe.transform({ description: '' }, meta)).toThrow(
      BadRequestException,
    );
  });

  it('lança BadRequestException quando descrição é muito curta', () => {
    expect(() =>
      pipe.transform({ description: 'curto' }, meta),
    ).toThrow(BadRequestException);
  });

  // ─── RF-2.1 AC3 — máximo ─────────────────────────────────────────────────

  it('lança BadRequestException quando descrição excede o limite máximo', () => {
    const tooLong = 'x'.repeat(VACANCY_MAX_LENGTH + 1);
    expect(() => pipe.transform({ description: tooLong }, meta)).toThrow(
      BadRequestException,
    );
  });

  // ─── happy path ───────────────────────────────────────────────────────────

  it('passa e trimma descrição válida', () => {
    const result = pipe.transform({ description: `  ${valid}  ` }, meta);
    expect(result.description).toBe(valid); // trim aplicado pelo .transform()
    expect(result.description.length).toBe(valid.length);
  });

  it('retorna mensagens de erro legíveis ao falhar', () => {
    try {
      pipe.transform({ description: '' }, meta);
    } catch (err: any) {
      expect(err.response.message).toBeInstanceOf(Array);
      expect(err.response.message[0]).toMatch(/ao menos/i);
    }
  });
});
