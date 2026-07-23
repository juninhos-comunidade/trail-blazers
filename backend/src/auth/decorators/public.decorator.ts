import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Libera uma rota (ou um controller inteiro) do `JwtAuthGuard` global.
 * Use apenas onde a ausência de autenticação for intencional.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
