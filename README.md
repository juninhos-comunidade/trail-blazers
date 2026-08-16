<div align="center">

# InterviewTrail

**Chegue preparado para a entrevista técnica.**

O InterviewTrail analisa a vaga e seus repositórios para montar uma entrevista técnica sob medida — com perguntas que citam trechos reais do seu próprio código.

[**🚀 Acessar a aplicação em produção**](https://trail-blazers-frontend.vercel.app/)

Projeto desenvolvido pelo time **Trail Blazers** para o Hackathon Comunidade Juninhos & Nortjobs
</div>

---

## Índice

- [O problema e a solução](#o-problema-e-a-solução)
- [Como funciona](#como-funciona)
- [Time](#time)
- [Stack técnica](#stack-técnica)
- [Arquitetura](#arquitetura)
- [Uso de IA no desenvolvimento](#uso-de-ia-no-desenvolvimento)
- [Rodando localmente](#rodando-localmente)
- [Testes](#testes)
- [Deploy](#deploy)
- [Troubleshooting](#troubleshooting)
- [Licença e créditos](#licença-e-créditos)

---

## O problema e a solução

Candidatos em início de carreira costumam chegar a entrevistas técnicas sem saber exatamente o que será cobrado, nem como o próprio portfólio será interpretado por quem está do outro lado da mesa. Essa incerteza — mais do que a falta de conhecimento em si — é uma das maiores fontes de insegurança em processos seletivos de tecnologia.

O **InterviewTrail** ataca esse problema de um jeito direto: em vez de gerar perguntas genéricas de "prepare-se para entrevistas de TI", ele cruza duas fontes de informação **do próprio candidato**:

1. A **vaga real** que ele está mirando (tecnologias, senioridade e competências exigidas);
2. O **código real** que ele escreveu, extraído de um repositório do GitHub escolhido por ele.

O resultado é uma simulação de entrevista personalizada, com perguntas que um recrutador técnico faria de fato — incluindo perguntas que apontam para trechos específicos do código do candidato — seguida de um relatório de desempenho ao final.

## Como funciona

A jornada do usuário na aplicação segue estes passos:

1. **Login** — autenticação via GitHub OAuth. Nenhuma senha é criada ou armazenada pela aplicação.
2. **Descrição da vaga** — o usuário cola o texto de uma vaga real. Uma IA extrai automaticamente um perfil estruturado: tecnologias, nível de senioridade e competências-chave.
3. **Escolha do repositório** — o usuário seleciona um repositório do seu próprio GitHub para servir de base da entrevista.
4. **Seleção inteligente de arquivos** — antes de gerar qualquer pergunta, uma IA analisa a lista de arquivos do repositório e escolhe, entre 5 e 20 deles, os mais relevantes *para aquela vaga específica* (o repositório inteiro não é enviado de uma vez; a escolha muda conforme a vaga).
5. **Entrevista simulada** — perguntas são geradas e conduzidas com narração por voz, distribuídas em quatro tipos:
   - `logic` — raciocínio técnico geral;
   - `scenario` — situação hipotética de trabalho (ex.: incidente em produção, priorização de tarefas);
   - `project` — decisões reais tomadas no repositório do candidato;
   - `code_analysis` — aponta um trecho real de código do candidato e questiona sobre ele.
6. **Relatório final** — ao término, a aplicação gera uma avaliação com pontuação geral, notas por dimensão, aderência à vaga, pontos fortes, lacunas e recomendações.

## Time

| Integrante | Função no projeto | GitHub |
|---|---|---|
| Matheus Aroxa | Full-stack — liderança técnica do projeto: setup inicial (NestJS/React), autenticação (OAuth GitHub + JWT), módulos de vagas, usuários, criptografia, entrevista (orquestração, geração de perguntas e relatório), TTS, integração com IA, tooling (ESLint, Prettier, Husky, commitlint) e a maior parte das telas e componentes do frontend | [`@matheus-aroxa`](https://github.com/matheus-aroxa) |
| Dayvson (Davyusow) | Backend — módulo `repos`: leitura, filtragem e cache da análise de repositórios do GitHub; setup do ambiente local | `@Davyusow` |
| Filipe Moreira | Backend — módulo `job-vacancy` (RF-2) e conexão com IA | `@FilipedevGenz` |
| Vinícius Leôncio | Backend — módulo `vacancies` (RF-2.1: cadastro, validação e persistência de vagas) | `@viniciusleoncio3267` |

> Funções levantadas a partir do histórico de commits do repositório (`git log --author`), com os commits das contas "Matheus Aroxa" e "matheut" consolidados sob um único integrante. Os demais handles de GitHub foram inferidos a partir do nome de usuário associado a cada commit — vale uma conferência rápida do time antes de publicar, caso algum apelido de commit não corresponda ao handle real.

## Stack técnica

**Backend** — `/backend`
- [NestJS 11](https://nestjs.com/) (TypeScript)
- [Prisma 7](https://www.prisma.io/) + PostgreSQL 16
- Autenticação: Passport (`passport-github2`) + JWT (`@nestjs/jwt`)
- Validação: `class-validator`/`class-transformer` nos DTOs de entrada, `zod` na validação das respostas geradas por IA, `joi` na validação de variáveis de ambiente
- `cache-manager` para cache em memória
- Criptografia AES-256 do token de acesso do GitHub antes de persistir no banco

**Frontend** — `/frontend`
- [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- React Router 7

**Inteligência Artificial**
- Geração de texto via [OpenRouter](https://openrouter.ai/) (modelo padrão configurável, `openai/gpt-oss-20b:free`), usada em três pontos: extração do perfil da vaga, seleção dos arquivos relevantes do repositório e geração das perguntas de entrevista.
- Narração por voz via [Azure Speech](https://azure.microsoft.com/products/ai-services/ai-speech) (tier gratuito), com **fallback automático** para a Web Speech API nativa do navegador caso a chave não esteja configurada ou o limite do tier gratuito seja atingido.

**Infraestrutura**
- PostgreSQL via Docker Compose para desenvolvimento local
- Deploy do frontend na [Vercel](https://vercel.com/)

## Arquitetura

### Backend — módulos

O backend é organizado em módulos NestJS com responsabilidade única:

```
src/
├── auth/        # OAuth GitHub, JWT, guards e estratégias Passport
├── users/        # Perfil do usuário autenticado
├── crypto/        # Criptografia/descriptografia do token do GitHub
├── prisma/        # Cliente Prisma e acesso a dados
├── repos/        # Integração com a API do GitHub e seleção de arquivos por IA
├── vacancies/        # Recebimento e parsing de vagas via IA
├── ai/        # Provider de IA (OpenRouter), abstraído por interface
├── interview/        # Orquestração de sessões, geração de perguntas e relatório
└── tts/        # Text-to-speech (Azure Speech)
```

Uma decisão de design vale destacar: o acesso à IA é abstraído por uma porta (`AiProviderPort`), então o `OpenRouterProvider` é uma implementação substituível — trocar de fornecedor de IA não exige alterar a lógica de negócio dos módulos que a consomem.

### Modelo de dados

O schema relacional (Prisma) reflete o ciclo de vida de uma entrevista:

```
User ──< Vacancy ──< Session ──< SessionRepo
                          │              │
                          ├──< Question ─┘
                          │        │
                          │        └── Answer
                          └── Report
```

- Cada `Session` amarra um usuário, uma vaga e um ou mais repositórios analisados.
- Cada `Session` também acumula `totalInputTokens`, `totalOutputTokens` e `estimatedCost`, permitindo rastrear o custo de IA por entrevista.
- `Question` guarda o tipo (`logic`/`scenario`/`project`/`code_analysis`), sua ordem e, quando aplicável, o repositório/arquivo de origem.
- `Report` guarda a nota geral, notas por dimensão, aderência à vaga, pontos fortes, lacunas e recomendações — todas geradas ao fim da sessão.

### Segurança e privacidade

- O token de acesso do GitHub do usuário é **criptografado em AES-256** antes de ser salvo no banco (nunca em texto puro).
- Autenticação stateless via JWT, com todas as rotas protegidas por guards.
- Validação estrita de entrada (`whitelist`/`forbidNonWhitelisted`) em todos os endpoints do backend.
- Em conformidade com a exigência do edital, a aplicação não coleta nem armazena dados pessoais de terceiros: apenas os dados do próprio usuário autenticado e o conteúdo público de repositórios que ele mesmo escolhe analisar.

## Uso de IA no desenvolvimento

Conforme recomendado pelo edital, registramos aqui como ferramentas de IA foram usadas ao longo do desenvolvimento deste projeto:

- **Documentação** — reescrita e revisão de documentos técnicos que haviam sido inicialmente redigidos à mão pelo time (requisitos, arquitetura, guia de estilo).
- **Planejamento** — apoio na estruturação de requisitos e decisões de arquitetura antes da implementação.
- **Desenvolvimento** — uso como ferramenta de apoio durante a codificação ao longo do período do hackathon.

Toda contribuição de IA foi revisada, validada e integrada pelo time, que permanece responsável pela autoria, funcionamento e compreensão integral da solução entregue — a arquitetura, as decisões de produto e as escolhas técnicas descritas neste README refletem decisões efetivas da equipe.

*(Nota: além do uso no processo de desenvolvimento, IA também é o mecanismo central do produto em si — é o que gera o perfil da vaga, seleciona os arquivos relevantes do repositório e produz as perguntas e o relatório final da entrevista, como descrito em [Como funciona](#como-funciona).)*

## Rodando localmente

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (para o PostgreSQL local)
- Uma conta no GitHub para criar um [OAuth App](https://github.com/settings/developers)
- Uma chave de API da [OpenRouter](https://openrouter.ai/keys) (obrigatória)
- Opcional: uma chave do [Azure Speech](https://azure.microsoft.com/products/ai-services/ai-speech) (sem ela, a narração cai automaticamente para a Web Speech API do navegador)

### 1. Clonar o repositório

```bash
git clone https://github.com/juninhos-comunidade/trail-blazers.git
cd trail-blazers
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Preencha o `.env` com:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Sim | Credenciais do OAuth App criado no GitHub |
| `GITHUB_CALLBACK_URL` | Sim | Deve ser idêntica à cadastrada no OAuth App |
| `JWT_SECRET` | Sim | Mínimo de 32 caracteres. Gere com `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Sim | 64 caracteres hexadecimais (32 bytes). Gere com `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | Sim | Sem ela a aplicação não sobe. Gere em [openrouter.ai/keys](https://openrouter.ai/keys) |
| `AI_MODEL` | Não | Padrão: `openai/gpt-oss-20b:free` |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` / `AZURE_SPEECH_VOICE` | Não | Sem a chave, o endpoint de TTS cai para a Web Speech API no navegador |
| `FRONTEND_URL` | Não | Padrão: `http://localhost:3001` |

Suba o banco e rode as migrations:

```bash
npm run db:up              # sobe o PostgreSQL via Docker Compose
npm run prisma:migrate     # aplica as migrations
npm run start:dev          # inicia o backend em modo watch (porta 3000)
```

### 3. Frontend

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

Confirme que `VITE_API_URL` no `.env` aponta para o backend (padrão: `http://localhost:3000`).

```bash
npm run dev
```

A aplicação sobe em `http://localhost:3001` (ou na porta indicada pelo Vite).

### 4. Criando o OAuth App do GitHub para desenvolvimento local

Em [github.com/settings/developers](https://github.com/settings/developers), crie um novo OAuth App com:
- **Homepage URL:** `http://localhost:3001`
- **Authorization callback URL:** `http://localhost:3000/auth/github/callback`

## Testes

O backend usa Jest, com **cobertura mínima de 80%** configurada como threshold no `package.json` (statements, branches, functions e lines):

```bash
cd backend
npm run test          # testes unitários
npm run test:e2e      # testes end-to-end
npm run test:cov      # com relatório de cobertura
```

O frontend usa Vitest, com o mesmo threshold de 80% de cobertura configurado no `vite.config.ts`:

```bash
cd frontend
npm run test           # modo watch, para desenvolvimento
npm run test:run       # roda uma vez e sai — usado pelo CI
npm run test:coverage  # com relatório de cobertura
```

Um workflow do GitHub Actions (`.github/workflows/ci.yml`) roda `test`/`test:cov` do backend e `test:coverage` do frontend a cada push e pull request, então uma regressão nos testes ou uma queda de cobertura abaixo do threshold bloqueia o merge — não depende de alguém lembrar de rodar localmente.

## Deploy

O frontend está publicado na Vercel: **[trail-blazers-frontend.vercel.app](https://trail-blazers-frontend.vercel.app/)**

Como o repositório oficial do hackathon vive na organização da comunidade (`Juninhos-Comunidade/trail-blazers`) e a Vercel está conectada a um fork pessoal para o deploy, um workflow do GitHub Actions (`.github/workflows/notify-fork.yml`) dispara automaticamente uma sincronização do fork a cada push na branch `main` do repositório oficial — garantindo que o ambiente de produção reflita sempre o código mais recente aprovado, sem depender de sincronização manual.

## Troubleshooting

**A aplicação não sobe / erro de variável de ambiente ausente**
O backend valida todas as variáveis obrigatórias na inicialização (via Joi) e falha explicando exatamente qual está faltando ou mal formatada — confira a mensagem de erro no terminal.

**Erro 401 ao chamar a API após o login**
Confirme que `GITHUB_CALLBACK_URL` no backend é *exatamente* igual à cadastrada no OAuth App do GitHub, e que `VITE_API_URL` no frontend aponta para a porta correta do backend.

**A narração por voz não funciona / cai para a voz do navegador**
Isso é o comportamento esperado quando `AZURE_SPEECH_KEY`/`AZURE_SPEECH_REGION` não estão configuradas, ou quando o limite de 1 requisição concorrente do tier gratuito é atingido — é um fallback intencional, não um erro. A interface avisa o usuário quando isso acontece.

**Erro de geração de perguntas ou de parsing da vaga**
Confirme que `OPENROUTER_API_KEY` é válida e tem créditos/uso disponível no modelo configurado em `AI_MODEL`. Os erros mais comuns (`invalid_api_key`, `rate_limited`, `payment_required`, `timeout`) são tratados de forma explícita pela API e retornados com essa causa identificada.

**Testes do frontend falham com `Cannot read properties of undefined (reading 'clear')` em `src/test/setup.ts`**
A partir do Node 22.4, o próprio runtime expõe um `localStorage` global experimental (sem `--localstorage-file`, ele resolve para `undefined`) que sobrepõe o `localStorage` funcional que o jsdom tentaria fornecer — o Vitest só copia do jsdom as chaves que ainda não existem no global do Node, então essa aí nunca chega a ser copiada. Os scripts `test`/`test:run`/`test:coverage` do `frontend/package.json` já contornam isso com a flag `--no-experimental-webstorage`; esse erro só aparece se algo chamar `vitest`/`npx vitest` diretamente, pulando o script do `package.json`. Use `npm run test:run` (ou `npm test` a partir da raiz), não `npx vitest run`.

## Licença e créditos

Projeto desenvolvido para o **Hackathon Comunidade Juninhos & Nortjobs** (jul–ago/2026) pelo time **Trail Blazers**.

Dados fictícios (mockados) são recomendados para testes na aplicação, em conformidade com a LGPD e com as diretrizes de privacidade do edital do hackathon.
