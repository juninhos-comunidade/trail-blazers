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
});
