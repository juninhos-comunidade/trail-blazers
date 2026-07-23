import * as Joi from 'joi';

//Arquivo de validação de variaveis de ambiente

//Novas variaveis de ambiente devem ser adicionadas aqui para que tenham mensagens de erro personalizadas

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  PORT: Joi.number().default(3000),

  // Exemplo de variável obrigatória (banco de dados)
  DATABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'DATABASE_URL é obrigatória. Defina-a no arquivo .env',
    'string.uri': 'DATABASE_URL deve ser uma URL válida (ex: postgres://user:pass@host:5432/db)',
  }),

  // OAuth do GitHub
  GITHUB_CLIENT_ID: Joi.string().required().messages({
    'any.required': 'GITHUB_CLIENT_ID é obrigatória. Pegue-a no OAuth App do GitHub',
  }),
  GITHUB_CLIENT_SECRET: Joi.string().required().messages({
    'any.required': 'GITHUB_CLIENT_SECRET é obrigatória. Pegue-a no OAuth App do GitHub',
  }),
  GITHUB_CALLBACK_URL: Joi.string().uri().required().messages({
    'any.required': 'GITHUB_CALLBACK_URL é obrigatória e deve ser igual à cadastrada no OAuth App',
    'string.uri': 'GITHUB_CALLBACK_URL deve ser uma URL válida',
  }),

  // JWT
  JWT_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_SECRET é obrigatória. Defina-a no arquivo .env',
    'string.min': 'JWT_SECRET deve ter pelo menos 32 caracteres',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),

  // Front-end (destino do redirect após o login)
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3001'),
});
