import { Reflector } from '@nestjs/core';
import { AuthController } from '../auth.controller';
import { IS_PUBLIC_KEY, Public } from './public.decorator';

describe('Public', () => {
  const reflector = new Reflector();

  // CT-05.6
  it('marca a classe com o metadata isPublic', () => {
    @Public()
    class ControllerPublico {}

    expect(reflector.get(IS_PUBLIC_KEY, ControllerPublico)).toBe(true);
  });

  it('marca o handler com o metadata isPublic', () => {
    class ControllerMisto {
      @Public()
      aberto() {}

      protegido() {}
    }

    // o metadata do handler fica no método do prototype, que é o que o guard lê
    const prototype = ControllerMisto.prototype;

    /* eslint-disable @typescript-eslint/unbound-method -- só lemos o metadata, não chamamos */
    expect(reflector.get(IS_PUBLIC_KEY, prototype.aberto)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, prototype.protegido)).toBeUndefined();
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('não marca nada sem o decorator', () => {
    class ControllerProtegido {}

    expect(reflector.get(IS_PUBLIC_KEY, ControllerProtegido)).toBeUndefined();
  });

  // garante que a exceção do AuthController é intencional e continua valendo
  it('o AuthController está marcado como público', () => {
    expect(reflector.get(IS_PUBLIC_KEY, AuthController)).toBe(true);
  });
});
