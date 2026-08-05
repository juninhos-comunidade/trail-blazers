# Integração RF-3.3 + RF-2 — o que foi feito, o que quebrou e o que verificar

> **Escopo:** PR #61 (`feature/RF-3.3` — leitura e filtragem de repositório) e PR #62
> (`feature/RF-2` — cadastro de vaga + parsing por IA).
> **Data:** 2026-08-03

---

## 0. Estado atual (leia primeiro)

| Branch | Estado |
|---|---|
| `origin/develop` | intocada, como estava — PR #61 mergeada, sem a PR #62 |
| `fix/rf-2-integracao` (local) | merge da PR #62 + **todas as correções aplicadas**, sem push |

**As correções já foram feitas** (commit `596f22a`). O que este documento descreve nas
seções §4.1 a §4.3 é o **diagnóstico**, mantido como registro do que estava errado e por quê.
O status de cada item está marcado ✅ (corrigido) ou ⬜ (em aberto).

Decisão de arquitetura tomada: a rota pública continua **`/vacancies`**, mas o código é o da
PR #62. O módulo `job-vacancy` foi removido.

Verificação já executada na branch:

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpo |
| `npm run lint` | ✅ limpo |
| `npm test` | ✅ 100 de 101 (1 falha pré-existente, ver §4.5) |
| `npm run build && node dist/src/main.js` | ✅ sobe e mapeia as 3 rotas |
| `npx prisma migrate dev` | ✅ migration `20260803122348_add_parsed_out_of_scope` aplicada |
| `npm run test:cov` | ⬜ 62% — abaixo do threshold de 80% (ver §4.5) |

---

## 1. Panorama rápido

| | PR #61 — RF-3.3 | PR #62 — RF-2 |
|---|---|---|
| Branch | `feature/RF-3.3` | `feature/RF-2` |
| Autor | matheut | FilipedevGenz |
| Estado | mergeada na `develop` | mergeada local, **não builda** |
| Escopo | backend + frontend | **só backend** |
| Base do branch | `develop` atual | `f6f0db4` (**desatualizada**, PR #55) |
| Compila? | sim | **não** — 7 erros de tipo |
| Testes | não adicionou | 3 specs, 1 deles quebrado |

A causa raiz da maior parte da dor de integração é uma só: **a PR #62 foi cortada de uma
base antiga**, anterior ao commit `4de87ac` (`fix: job passa a substituir vacancy`), que
renomeou o model `Job` → `Vacancy`. Tudo que segue é consequência disso ou de dependências
não declaradas.

---

## 2. PR #61 — RF-3.3: leitura e filtragem do repositório

### 2.1 O que foi entregue

**Backend** (`backend/src/repos/`):

- `analyzeRepositoryContent(userId, owner, repo)` em `repos.service.ts` — orquestra todo o fluxo.
- Rota nova: `GET /repositories/:owner/:repo/analyze` em `repos.controller.ts`.
- Cache em memória: `CacheModule.register({ ttl: 300_000, max: 100 })` em `repos.module.ts`.
- Dependências novas: `@nestjs/cache-manager`, `cache-manager`.

**Frontend:**

- `analyzeRepo(owner, name)` em `frontend/src/lib/repositories-api.ts`.
- Estado `"analyzing"` e handler `startInterview` em `RepositoryChooserPage.tsx`.

### 2.2 Como funciona (importante para quem for consumir)

**Não há IA nenhuma nesse fluxo.** É 100% API REST do GitHub + heurística determinística:

1. `GET /repos/:owner/:repo/git/trees/HEAD?recursive=1` — uma chamada, traz a árvore inteira
   sem clonar o repositório.
2. Filtro por *denylist* (`isFileRelevant`): três `Set` com diretórios (`node_modules`,
   `dist`, `build`, `.git`, `coverage`, `.next`, `out`, `vendor`, `public`), extensões
   (binários, imagens, `.lock`) e nomes de arquivo (`package-lock.json`, `yarn.lock`,
   `pnpm-lock.yaml`).
3. Ranking por pontuação inteira (`sortFilesByRelevance`): `package.json`/`docker-compose`
   +100, arquivos sob `src/`/`app/`/`lib/` +50, README +40.
4. Orçamento: baixa arquivo por arquivo de `raw.githubusercontent.com` somando caracteres
   até `MAX_CONTEXT_CHARS = 80.000` (~20 mil tokens a 4 chars/token). O que não coube vai
   para `omittedFiles`.
5. Resultado salvo no cache com chave `repo_analysis_${userId}_${owner}_${repo}`.

**O cache é memória do processo Node.** `CacheModule.register` sem a opção `store` usa o
armazenamento em memória padrão do `cache-manager`. **Não há infraestrutura para provisionar**
— nada de Redis, nada de container extra, nada de variável de ambiente. Trade-offs aceitos:
morre a cada restart/deploy, não é compartilhado entre réplicas, e o teto de memória é da
ordem de 15–20 MB (100 entradas × 80 mil chars).

### 2.3 Pendências conhecidas do RF-3.3 (não bloqueiam a develop, mas estão abertas)

| # | Item | Impacto |
|---|---|---|
| 1 | `ButtonLink` é um `<Link>` do react-router e o `onClick` não chama `preventDefault()` — a navegação acontece antes da análise terminar | O spinner "Analisando…" e o tratamento de erro são **inalcançáveis**. A análise vira *fire-and-forget*. |
| 2 | No erro, `setStatus("error")` esconde a `RepositoryList` (renderizada só em `status === "success"`) | O usuário **não consegue escolher outro repositório** — viola o edge case explícito do RF-3.3. |
| 3 | `fetchFileRawContent` devolve `''` em qualquer falha | Arquivos vazios entram silenciosamente em `relevantFiles`. Além disso `raw.githubusercontent.com` + `Bearer` é pouco confiável em repositório privado. Alternativa: `GET /repos/:o/:r/contents/:path` com `Accept: application/vnd.github.raw`. |
| 4 | Download sequencial (N+1) sem `MAX_FILES` | Repositório grande = dezenas de requisições em série. Usar o campo `size` que a própria árvore já devolve para orçar **antes** de baixar, e paralelizar em lotes de 5–8. |
| 5 | A heurística ignora "relevância para a stack da vaga" (critério 1 do RF) | **Desbloqueado pela PR #62**: `parsedStack` agora existe. Ver §6. |
| 6 | Chave de cache sem SHA do commit; TTL de 5 min | Conteúdo obsoleto por até 5 min após um push; e 5 min é menos que uma entrevista. Sugestão: incluir o SHA e subir o TTL para 30–60 min. |
| 7 | `String(candidatePaths).length === 0` | Só funciona por acidente. Use `candidatePaths.length === 0`. |
| 8 | Campo `truncated` da resposta do GitHub é tipado mas ignorado | Repositórios muito grandes vêm com árvore incompleta e ninguém percebe. |
| 9 | `owner`/`repo` interpolados na URL sem validação/`encodeURIComponent` | Baixo risco (vêm de rota autenticada), mas é higiene. |
| 10 | `console.log` no service | Trocar por `Logger` do Nest. |

---

## 3. PR #62 — RF-2: cadastro de vaga + conexão com IA

### 3.1 O que foi entregue

14 arquivos, +789 linhas, **nenhuma linha de frontend**.

```
POST /job-vacancies
   └─ ZodValidationPipe (descrição 50..10.000 chars)
   └─ JobVacancyService.create()
        ├─ prisma.job.create()  → responde 201 IMEDIATAMENTE
        └─ runParsing()  ← fire-and-forget, não bloqueia a resposta
             └─ VacancyParserService.parse()
                  ├─ quickScopeCheck()          heurística barata, sem IA
                  ├─ AiProviderPort.complete()  ← porta abstrata (DI)
                  └─ AiResponseSchema.safeParse()  ← Zod valida a saída da IA
GET /job-vacancies/:id   → polling até parsingCompleted = true
GET /job-vacancies       → lista as vagas do usuário
```

Arquivos novos:

- `src/ai/ai.module.ts`, `src/ai/openrouter.provider.ts` — adapter da OpenRouter.
- `src/job-vacancy/vacancy-parser.service.ts` — porta `AiProviderPort` + prompt + fallbacks.
- `src/job-vacancy/job-vacancy.{service,controller,module}.ts`
- `src/job-vacancy/schemas/job-vacancy.schema.ts` — schemas Zod.
- `src/job-vacancy/schemas/zod-validation.pipe.ts` — pipe genérico Zod→`BadRequestException`.
- 3 arquivos de spec (326 linhas).
- `env.validation.ts`: `OPENROUTER_API_KEY` (obrigatória), `AI_MODEL`, `APP_TITLE`.

### 3.2 O que está bem feito (preservar nas correções)

- **`AiProviderPort` como classe abstrata usada de token de DI.** O parser não conhece a
  OpenRouter. Trocar de provedor é uma linha no `ai.module.ts`. Isso é *ports & adapters*
  corretamente aplicado.
- **Nunca confiar na saída do modelo.** `AiResponseSchema` usa `.catch('unknown')`,
  `.default([])` e `.max(15)`; há três camadas de fallback (erro de rede, JSON inválido,
  Zod reprovado) e todas caem em `GENERIC_PROFILE`. O parser não derruba a aplicação.
- **Parsing assíncrono.** O 201 volta na hora; o LLM roda em background. Sem isso seriam
  5–15 segundos de tela travada.

---

## 4. O que falhava, e por quê

### 4.1 Erros que impedem o build — verificados com `npx tsc --noEmit`

Na `develop` já mergeada, o typecheck acusa exatamente **7 erros**:

```
src/job-vacancy/job-vacancy.service.spec.ts(5,38): TS2307: Cannot find module '../ai/vacancy-parser.service'
src/job-vacancy/job-vacancy.service.ts(27,35):     TS2339: Property 'job' does not exist on type 'PrismaService'
src/job-vacancy/job-vacancy.service.ts(41,35):     TS2339: Property 'job' does not exist on type 'PrismaService'
src/job-vacancy/job-vacancy.service.ts(47,36):     TS2339: Property 'job' does not exist on type 'PrismaService'
src/job-vacancy/job-vacancy.service.ts(61,23):     TS2339: Property 'job' does not exist on type 'PrismaService'
src/job-vacancy/schemas/job-vacancy.schema.ts(1,19):     TS2307: Cannot find module 'zod'
src/job-vacancy/schemas/zod-validation.pipe.ts(7,37):   TS2307: Cannot find module 'zod'
```

---

#### ✅ **B1 — `zod` não está declarado no `package.json`**

**O que falha:** `npm ci` seguido de `npm run build` quebra em qualquer máquina que não
seja a do autor.

**Por quê:** a PR introduz Zod em 3 arquivos e nunca roda `npm i zod --save`. Funciona na
máquina de quem escreveu porque o pacote já estava no `node_modules` local. É a falha
clássica de "esqueci o `--save`".

**Correção:**
```bash
cd backend && npm i zod@^3.25 --save
```

⚠️ **A versão importa.** O código usa a API do **Zod 3**:
- `z.string({ required_error: '...' })` — no Zod 4 virou `error`.
- `result.error.errors` no `zod-validation.pipe.ts` — no Zod 4 virou `result.error.issues`.

Se instalarem `zod@latest` (v4), o pipe compila mas **quebra em runtime** ao formatar a
mensagem de erro. Ou fixem em `^3.25`, ou adaptem os dois pontos acima.

---

#### ✅ **B2 — `prisma.job` não existe; o model se chama `Vacancy`**

**O que falha:** os 4 erros `TS2339` acima. Em runtime seria `TypeError: Cannot read
properties of undefined`.

**Por quê:** aqui está a raiz de quase tudo. A `feature/RF-2` foi cortada de `f6f0db4`
(PR #55), **antes** do commit `4de87ac` (`fix: job passa a substituir vacancy`), que
renomeou o model `Job` → `Vacancy` e a tabela `jobs` → `vacancies`. O autor programou
contra um schema que já não existe mais na `develop`. O nome do commit é confuso — ele
faz o *inverso* do que o texto sugere: quem passou a valer foi `Vacancy`.

**Correção** — em `job-vacancy.service.ts`, 4 ocorrências:
```diff
- this.prisma.job.create(...)      → this.prisma.vacancy.create(...)
- this.prisma.job.findFirst(...)   → this.prisma.vacancy.findFirst(...)
- this.prisma.job.findMany(...)    → this.prisma.vacancy.findMany(...)
- this.prisma.job.update(...)      → this.prisma.vacancy.update(...)
```
O resto do shape é idêntico (`rawDescription`, `parsedStack`, `parsedSeniority`,
`parsedSkills`, `parseConfidence`, `createdAt`) — a renomeação foi só de nome de model
e tabela. **Não é necessária migration nova**: a migration `20260721132933_init` já cria
a tabela `vacancies`.

---

#### ✅ **B3 — `job-vacancy.service.spec.ts` foi escrito contra uma versão antiga do service**

**O que falha:** a suíte inteira. Três incompatibilidades no mesmo arquivo:

```ts
import { VacancyParserService } from '../ai/vacancy-parser.service';  // ❌ está em ./vacancy-parser.service
prisma = { jobVacancy: { create: jest.fn(), ... } };                  // ❌ o service chama prisma.job (→ vacancy)
const makeVacancy = () => ({ description, parsedProfile, ... });      // ❌ devolve o shape de RESPOSTA, mas
                                                                      //    toResponse() lê rawDescription/parseConfidence
```

Há ainda um quarto problema mais sutil: o mock não define `parseConfidence`, e
`toResponse` calcula `parsingCompleted = parseConfidence !== null`. Como `undefined !== null`
é `true`, a asserção `expect(result.parsingCompleted).toBe(false)` falharia mesmo com o
import corrigido.

**Por quê:** os testes foram escritos primeiro, o service foi refatorado depois, e ninguém
rodou `npm test` antes de abrir a PR. **Não há CI rodando testes no repositório** — só o
workflow `notify-fork.yml`. Essa é a causa sistêmica, e as duas PRs sofreram dela.

**Correção:** reescrever os fixtures no shape do **banco** (`rawDescription`,
`parseConfidence: null`), corrigir o import e trocar `jobVacancy` por `vacancy`.
Os outros dois specs (`vacancy-parser.service.spec.ts` e `zod-validation.pipe.spec.ts`)
parecem consistentes com o código.

---

#### **B4 — imports `'src/...'` no `app.module.ts` (já corrigido no merge)**

**O que falhava:** a PR trazia `import { AiModule } from 'src/ai/ai.module'`. Isso
**compila** (por causa de `baseUrl: "./"`), mas o `tsc` **não reescreve paths na emissão**.
Compilei a branch para confirmar:

```js
const ai_module_1 = require("src/ai/ai.module");   // ← MODULE_NOT_FOUND em runtime
```

Com `npm run start:prod` (`node dist/main`, sem `tsconfig-paths/register`) o app não sobe.

**Situação:** resolvido na resolução de conflito do merge — trocado por caminho relativo.

**⚠️ Correção de uma afirmação anterior deste documento.** A primeira versão dizia que os
aliases `@repos/*`, `@users/*` etc. quebrariam em produção pelo mesmo motivo. **Isso está
errado.** O teste empírico derruba a hipótese: `npm run build` seguido de
`node dist/src/main.js` **sobe normalmente** e mapeia todas as rotas. O `nest build` faz
mais do que um `tsc` cru — ele resolve os aliases na emissão, e nenhum `require("@...")`
sobra no `dist/`. O que eu havia observado antes era a saída de um `tsc` invocado
diretamente, que de fato não resolve, mas não é o comando que vocês usam.

Os aliases estão seguros. O `start:prod` funciona. Fica só um registro: o alias
`@prisma/*` do `tsconfig.json` aponta para `./src/prisma/*` e colide com o pacote real
`@prisma/client`. Hoje funciona porque o TypeScript, ao não achar o arquivo local, cai no
`node_modules` — mas é uma colisão de nomes infeliz e vale renomear para `@db/*` algum dia.

---

### 4.2 Conflito de arquitetura — duas implementações do RF-2.1

Esta não é uma falha de código, é uma falha de coordenação, e é a decisão mais importante
a tomar:

| | `/vacancies` (já na `develop`) | `/job-vacancies` (PR #62) |
|---|---|---|
| Origem | commit `3343a81` + `4de87ac` | PR #62 |
| Validação | `class-validator` (`CreateVacancyDto`) | Zod (`CreateJobVacancySchema`) |
| Limite de descrição | 50–**5.000** chars | 50–**10.000** chars |
| Parsing por IA | **não tem** | sim |
| Leitura (`GET`) | **não tem** | `GET /:id` e `GET /` |
| Model Prisma | `prisma.vacancy` ✅ | `prisma.job` ❌ |

As duas rotas gravam **na mesma tabela** `vacancies`. Um usuário pode cadastrar por
`/vacancies` e a vaga nunca ser analisada; ou por `/job-vacancies` e receber um limite de
caracteres diferente. **Isso precisa ser unificado antes de qualquer integração com o
frontend.**

**Decisão tomada:** `/vacancies` é a rota canônica — é o nome do domínio, do model e da
tabela — e o parsing, o `GET /:id` e os schemas Zod da PR #62 foram portados para dentro
dela. `src/job-vacancy/` foi removido.

⚠️ Note que **`POST /vacancies` já é consumido pelo frontend** (`JobDescriptionPage.tsx` →
`createVacancy()`). O contrato da resposta é, portanto, uma superfície pública: campos
existentes não podem ser renomeados sem alterar a tela junto. Ver a ressalva no item V0.

**Decidam isso primeiro**, porque todas as correções de B2/B3 mudam de lugar dependendo da
escolha.

---

### 4.3 Falhas de comportamento (compilam, mas quebram a experiência)

#### ✅ **C1 — `outOfScope` nunca chega ao usuário** *(violava critério de aceitação do RF-2.2)*

O parser calcula `outOfScope` corretamente, mas o model `Vacancy` **não tem coluna para
ele**, e o `toResponse` faz:

```ts
outOfScope: false,   // hardcoded
```

Efeito prático: candidato cola uma vaga de Gerente de Marketing → a API responde
`parsingCompleted: true`, `technologies: []`, `outOfScope: false`. O frontend não tem como
distinguir "vaga fora do escopo" de "vaga tech mal escrita". **Precisa de uma coluna nova**
(`parsedOutOfScope Boolean?`) e, portanto, de uma migration.

#### ✅ **C2 — não existe estado de falha**

`parsingCompleted = parseConfidence !== null` faz "processando" e "falhou" serem o mesmo
estado. Se o `prisma.update` dentro de `runParsing` lançar, o registro fica travado em
"processando" para sempre e o polling do frontend gira infinitamente — o `.catch()` só
escreve no log. **Correção mínima:** no catch, gravar o `GENERIC_PROFILE` no banco para o
polling terminar.

#### ✅ **C3 — nenhum timeout na chamada à OpenRouter**

`fetch` sem `AbortSignal` pode pendurar por minutos. Combinado com C2, resulta em polling
infinito. Adicionar `signal: AbortSignal.timeout(20_000)`.

#### ✅ **C4 — a saída da IA não é limpa de cercas markdown** *(era o bug mais provável na demo)*

O request manda `response_format: { type: 'json_object' }`, mas o modelo padrão
(`meta-llama/llama-3.1-8b-instruct:free`) **frequentemente ignora structured output** e
devolve a resposta envolvida em ` ```json … ``` `. Aí o `JSON.parse` lança e cai
silenciosamente em `GENERIC_PROFILE` — o usuário vê "nenhuma tecnologia identificada" sem
nenhum erro. Correção de uma linha antes do parse:

```ts
const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
```

#### ✅ **C5 — `quickScopeCheck` é um no-op em português**

A lista `TECH_SCOPE_KEYWORDS` contém `'ia'` e `'ai'`, e o teste é `includes()` sem
fronteira de palavra:

```
'experiência' contém "ia" ✅    'tecnologia' contém "ia" ✅    'mais' contém "ai" ✅
```

Praticamente qualquer texto em português passa pela heurística. A própria vaga de marketing
usada no spec (`NON_TECH_VACANCY`) contém "experiência" e "graduação" — ela **passa**. O
teste só verde porque o mock da IA devolve `outOfScope: true`. Use regex com `\b`.

#### ⬜ **C6 — modelo `:free` é armadilha de apresentação**

O tier gratuito da OpenRouter tem limite agressivo (na ordem de dezenas de requisições por
dia). Se vocês ensaiarem de manhã e a banca testar à tarde, vem `429` → `GENERIC_PROFILE`
→ demo sem graça, e sem mensagem de erro visível (ver C4/C2). **Coloquem US$ 5 de crédito
e usem um modelo barato pago.** É o melhor investimento de risco do projeto.

#### ✅ **C7 — `.env.example` não foi atualizado**

`OPENROUTER_API_KEY` é `required()` no Joi e `getOrThrow` no provider. Quem der `git pull`
amanhã recebe um erro de boot sem entender por quê.

---

### 4.4 Itens menores

Corrigidos junto com o resto:

- ✅ `description.slice(0, VACANCY_MAX_LENGTH)` removido — o Zod já rejeita acima do limite.
- ✅ `updatedAt: j.createdAt` removido do contrato — o model não tem `updatedAt` e a resposta
  estava mentindo para o cliente.
- ✅ `@UseGuards(JwtAuthGuard)` redundante removido do controller — já existe `APP_GUARD`
  global em `auth.module.ts`.
- ✅ `ZodValidationPipe` agora é genérico e tipado (`ZodValidationPipe<T extends ZodType>`),
  sem `any` e sem parâmetro não usado.

Em aberto, sem impacto funcional:

- ⬜ `parseConfidence` é `Float` (feito para score real) usado como enum de dois valores
  (`1.0`/`0.5`). Funciona, mas desperdiça a coluna.
- ⬜ `types: ["jest"]` no `tsconfig.json` é mudança não relacionada ao RF-2 e faz o código de
  produção enxergar globais de teste. Não quebra nada; eu removeria por higiene.
- ⬜ Espaço em branco sobrando no `env.validation.ts` depois de `APP_TITLE`.
- ⬜ A descrição da vaga é enviada a um terceiro (OpenRouter). No tier gratuito os prompts
  podem ser logados/usados para treino. Vale uma linha no README.
- ⬜ O `PARSE_SYSTEM_PROMPT` recebe o texto do usuário sem delimitador. Injeção de prompt aqui
  tem impacto baixo (o Zod contém o estrago), mas envolver em `<vaga>…</vaga>` custa nada.

---

### 4.5 O que continua vermelho (e não foi causado por estas PRs)

**⬜ `github.strategy.spec.ts` falha.** Um teste, com erro de uso do Jest:

```
Matcher error: received value must be a promise or a function returning a promise
  > 59 |  await expect(runValidate(buildProfile())).resolves.toEqual({
```

`runValidate` devolve um objeto, não uma Promise, então `.resolves` não se aplica.
**Confirmei que já falha na `develop`**, antes de qualquer coisa deste trabalho — não
mexi nele para não misturar escopos. Correção: trocar `.resolves.toEqual` por `.toEqual`.

**⬜ Cobertura em 62%, abaixo do threshold de 80%.** O `npm run test:cov` sai vermelho.
A dívida não é do RF-2 — o código novo está coberto:

| Arquivo | Cobertura |
|---|---|
| `vacancies.service.ts` | 100% stmts / 87.5% branches |
| `vacancy-parser.service.ts` | coberto pelo spec dedicado |
| **`repos.service.ts` (PR #61)** | **0% — 269 linhas sem um único teste** |
| `repos.controller.ts` | 0% |
| `vacancies.controller.ts` | 0% |
| `openrouter.provider.ts` | 0% |

O buraco é o `repos.service.ts`, que veio sem testes na PR #61. Duas saídas honestas:
escrever os testes, ou baixar o threshold conscientemente e registrar a dívida. O que não
vale é deixar o comando vermelho sem decisão — um threshold que ninguém respeita deixa de
ser um sinal.

---

## 5. Checklist de verificação para garantir a integração

As fases 1 a 4 **já foram executadas** na branch `fix/rf-2-integracao` — ficam registradas
com o resultado obtido. As fases 5 a 7 dependem de você.

### Fase 1 — decisão de arquitetura ✅

- [x] **V0.** Rota canônica: **`/vacancies`**, com o código da PR #62. Módulo `job-vacancy`
      removido.

      ⚠️ **Correção importante.** Versões anteriores deste documento afirmavam que nenhum
      frontend consumia as rotas de vaga. **Isso está errado** — foi um falso negativo de
      busca. `frontend/src/pages/JobDescriptionPage.tsx` chama `createVacancy()` de
      `lib/vacancies-api.ts`, que faz `POST /vacancies`, desde o commit `bc1adad`. Ou seja,
      a escolha de manter `/vacancies` **não era livre: era obrigatória**, exatamente como
      o time havia definido.

      Consequência prática: o contrato da resposta precisa preservar `rawDescription`, que
      é o campo lido pela tela (`created.rawDescription`). Renomear para `description`
      quebraria o cadastro **em silêncio** — sem erro de tipo e sem erro em runtime, apenas
      um `undefined` gravado no rascunho da entrevista.

### Fase 2 — fazer compilar ✅

- [x] **V1.** `npm i zod@^3.25 --save` → instalado `zod@3.25.76`.
- [x] **V2.** As 4 ocorrências de `prisma.job` trocadas por `prisma.vacancy`.
- [x] **V3.** `npx prisma generate && npx tsc --noEmit` → **saída vazia**.
- [x] **V4.** `npm run build && node dist/src/main.js` → **sobe**, mapeando
      `POST /vacancies`, `GET /vacancies/:id` e `GET /vacancies`. Nenhum `MODULE_NOT_FOUND`:
      o `nest build` resolve os aliases do `tsconfig.json` na emissão (ver a correção em §B4).

### Fase 3 — testes e lint ✅ (com uma ressalva)

- [x] **V5.** `vacancies.service.spec.ts` reescrito: fixtures no shape do banco, mocks em
      `prisma.vacancy`, mais casos para `outOfScope` e para as falhas de parsing.
- [x] **V6.** `npm test` → **100 de 101**. A única falha é `github.strategy.spec.ts`, que já
      estava vermelha na `develop` (§4.5).
- [ ] **V7.** `npm run test:cov` → **62%, abaixo do threshold de 80%**. Em aberto: a dívida é
      do `repos.service.ts` (PR #61), sem testes. Ver §4.5 — precisa de decisão.
- [x] **V8.** `npm run lint` → limpo.

### Fase 4 — banco de dados ✅

- [x] **V9.** Tabela confirmada como `vacancies`.
- [x] **V10.** Migration `20260803122348_add_parsed_out_of_scope` criada e aplicada, para o
      `outOfScope` do RF-2.2 parar de se perder (§C1).
      ⚠️ Quem for rodar a branch precisa executar `npx prisma migrate dev` para aplicá-la
      no banco local.

### Fase 5 — ambiente

- [ ] **V11.** Adicionar ao `.env` **e ao `.env.example`**:
      ```
      OPENROUTER_API_KEY=sk-or-v1-...
      AI_MODEL=meta-llama/llama-3.1-8b-instruct:free
      APP_TITLE=Trail Blazers
      ```
      Sem a chave o app **não sobe** (é `required` no Joi + `getOrThrow` no provider).
- [ ] **V12.** Avisar o time no canal que essa variável passou a ser obrigatória.
- [ ] **V13.** Se o backend for para deploy, cadastrar a variável no painel do provedor.

### Fase 6 — teste manual ponta a ponta

Com o app rodando e um JWT válido em mãos:

- [ ] **V14.** Vaga tech válida → `201` imediato, `parsingCompleted: false`.
- [ ] **V15.** `GET /:id` em loop → em poucos segundos vira `parsingCompleted: true` com
      `technologies` preenchido. **Se ficar preso em `false`, é C2/C3** — olhe o log do
      backend para ver se a chamada à IA falhou.
- [ ] **V16.** Vaga de marketing → agora deve devolver `outOfScope: true` (§C1 corrigido).
      Se vier `false`, a migration não foi aplicada no seu banco.
- [ ] **V17.** Descrição com 10 caracteres → `400` com mensagem do Zod.
- [ ] **V18.** Sem `Authorization` → `401`.
- [ ] **V19.** Derrube a internet (ou ponha uma `OPENROUTER_API_KEY` inválida) e cadastre
      uma vaga → deve terminar com perfil genérico, **não** ficar travado.
- [ ] **V20.** `GET /repositories/:owner/:repo/analyze` duas vezes seguidas → a segunda deve
      logar `[CACHE] Servindo análise…` e responder instantaneamente.
- [ ] **V21.** Repositório **privado** → confirmar se o conteúdo dos arquivos vem preenchido
      ou vazio (§2.3 item 3). É o caso mais provável na demo.

### Fase 7 — antes de subir

- [ ] **V22.** Não commitar o `.env` (confira o `.gitignore`). O `.env.example` **já foi
      atualizado** com as três variáveis novas.
- [ ] **V23.** Decidir o que fazer com a cobertura (§4.5) e com o
      `github.strategy.spec.ts` vermelho.
- [ ] **V24.** `git push origin fix/rf-2-integracao` e abrir PR para a `develop`.
- [ ] **V25.** Criar o workflow de CI (§7, item 2) — é o que impede a próxima PR de repetir
      isto tudo.

---

## 6. Ganho estratégico que a integração destrava

Vale registrar: `parsedStack` e `parsedSeniority` são exatamente o insumo que faltava para
o RF-3.3 cumprir o critério **"relevância para a stack da vaga"** (item 5 da tabela §2.3).
Hoje `sortFilesByRelevance` pontua por convenção de layout JavaScript (`src/`,
`package.json`, README) — ele funciona bem para projetos Node e mal para Go ou Java.

Depois da integração, dá para passar a stack da vaga para o
`analyzeRepositoryContent` e ponderar extensões por linguagem. É uma melhoria pequena em
código e grande em qualidade das perguntas geradas. Sugiro registrar como issue já
apontando para as duas PRs.

---

## 7. Sobre o processo (a causa sistêmica)

Três das quatro falhas de build têm a mesma origem, e nenhuma é sobre habilidade técnica:

1. **A branch estava desatualizada.** `feature/RF-2` saiu de `f6f0db4` e nunca recebeu um
   `git merge develop`. Duas semanas depois, o schema já era outro. Um `git merge develop`
   semanal teria evitado B2 inteiro.
2. **Não há CI rodando `build`, `test` e `lint`.** O único workflow é o `notify-fork.yml`.
   Um GitHub Action de ~20 linhas rodando `npm ci && npm run build && npm test` em cada PR
   teria barrado B1, B2 e B3 **automaticamente**, antes de qualquer humano revisar. É a
   correção de maior retorno neste projeto, e leva 15 minutos.
3. **Duas pessoas implementaram o RF-2.1 sem saber.** A duplicação `/vacancies` vs
   `/job-vacancies` custou trabalho dobrado e agora custa uma decisão de refatoração.

Nenhum desses é um problema de código — são de fluxo. Vale endereçar o item 2 hoje.
