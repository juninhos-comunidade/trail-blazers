# Documento de Requisitos — InterviewTrail

> **Projeto:** InterviewTrail
> **Equipe:** Trail Blazers
> **Contexto:** Hackathon Comunidade Juninhos & Nortjobs
> **Stack alvo:** NestJS (backend) + React (frontend) · Deploy na AWS (confirmado como plataforma válida junto à organização)
> **Equipe:** 4 integrantes · **Janela de desenvolvimento:** 16/07 a 15/08 · **Entrega:** 16/08
> **Versão do documento:** 1.1

---

## 1. Visão Geral

O InterviewTrail é uma aplicação web que **simula entrevistas técnicas personalizadas** para desenvolvedores em início de carreira. Diferente de plataformas de *quiz* ou *live coding* genéricas, o InterviewTrail gera o conteúdo da entrevista a partir de **dois insumos reais do candidato**: (1) a descrição da vaga que ele pretende disputar e (2) os repositórios do próprio GitHub. Com isso, a IA formula perguntas contextualizadas — incluindo questionamentos sobre as **decisões técnicas tomadas no código do candidato** — e, ao final, entrega um relatório de prontidão com pontos fortes, lacunas e recomendações.

O objetivo do produto é **mitigar a insegurança técnica** de profissionais em início de carreira, dando clareza sobre o que o mercado espera e onde estão as lacunas de conhecimento — que é exatamente o problema central proposto pelo edital.

## 2. Alinhamento com os Critérios de Avaliação

O produto foi desenhado para pontuar em todos os quesitos da banca (100 pts). Cada decisão de escopo deve ser justificável por pelo menos um critério:

| Critério (peso) | Como o InterviewTrail endereça |
|---|---|
| **Arquitetura e Qualidade Técnica (25)** | Backend modular em NestJS, camada de abstração do provedor de IA (troca de modelo sem reescrever regra de negócio), seleção inteligente de arquivos do repositório, máquina de estados da entrevista, testes e tratamento de erros de APIs externas. |
| **Usabilidade, Interface e Deploy (25)** | Fluxo enxuto (login → vaga → repositórios → entrevista → relatório), design responsivo, estados de carregamento/erro tratados, deploy funcional e estável em produção. |
| **Adequação ao Tema e Criatividade (25)** | Foco na dor real (insegurança e falta de clareza), diferencial genuíno de analisar o portfólio do candidato e questionar decisões arquiteturais em vez de apenas pedir algoritmos. |
| **Qualidade da Apresentação / Pitch (25)** | A demo do "wow" (IA questionando o código real do candidato) é o coração do pitch; landing page comunica a dor e a solução com clareza. |

## 3. Personas / Papéis de Usuário

- **Candidato (usuário primário):** desenvolvedor em início de carreira que quer se preparar para um processo seletivo específico. Autentica-se, informa a vaga, seleciona repositórios, realiza a entrevista simulada e consome o relatório.
- **Visitante:** usuário não autenticado que acessa a landing page e entende a proposta antes de se cadastrar.
- **Sistema/IA (ator não-humano):** componente que gera perguntas, analisa código e avalia respostas. Aparece nos critérios de aceitação como o agente que executa as ações.

> **Observação de escopo:** não há painel administrativo nem papel de recrutador no MVP. O produto é single-player e voltado ao candidato.

## 4. Escopo (priorização MoSCoW)

O escopo está priorizado para garantir um **MVP vencedor com folga**. Os itens **Must** formam o fluxo ponta a ponta que precisa estar impecável; **Should/Could** são incrementos que elevam a nota se houver tempo.

- **Must (MVP):** login com GitHub, cadastro de vaga com parsing, listagem/seleção de repositórios, leitura inteligente do código, motor de entrevista com pelo menos três tipos de pergunta (incluindo análise do repositório), condução da entrevista em interface de chat, avaliação e relatório final, landing page, deploy estável na AWS, dados mockados e README.
- **Should:** dashboard com histórico de sessões, streaming das respostas da IA, análise de código mais profunda (múltiplos arquivos), testes automatizados ampliados.
- **Could:** exportar relatório em PDF, comparação entre sessões, microinterações avançadas, internacionalização.
- **Won't (nesta fase):** suporte a GitLab, execução/live coding real de código, colaboração multiusuário, cobrança/planos pagos, painel de recrutador.

## 5. Glossário

- **Sessão de entrevista:** uma execução completa do fluxo (vaga + repositórios → perguntas → respostas → relatório).
- **Orçamento de tokens:** limite de tokens de contexto enviado ao modelo por requisição, para controlar custo.
- **Seleção inteligente de arquivos:** heurística que escolhe quais arquivos do repositório enviar à IA, priorizando relevância para a vaga e respeitando o orçamento de tokens.
- **Rubrica de avaliação:** conjunto de dimensões (ex.: lógica, conhecimento da stack, qualidade das decisões técnicas, aderência à vaga) usadas para pontuar as respostas.

## 6. Escala de Story Points

Escala de Fibonacci, calibrada para o ritmo do hackathon (equipe júnior, dedicação parcial):

| Pontos | Significado | Referência de esforço |
|---|---|---|
| **1** | Trivial, sem incerteza | Poucas horas (config, ajuste simples, tela estática) |
| **2** | Pequeno, baixa incerteza | ~meio dia |
| **3** | Médio, alguma complexidade | ~1 dia |
| **5** | Grande, complexidade ou incerteza real | ~2 dias |
| **8** | Muito grande, alta complexidade/incerteza | ~3–4 dias — avaliar quebrar |
| **13** | Não refinado — **deve ser quebrado** antes de entrar na sprint |

> **Convenção EARS:** os critérios de aceitação seguem o padrão *Easy Approach to Requirements Syntax*, traduzido: **QUANDO** [evento] **ENTÃO** o sistema **DEVE** [resposta]; **SE** [condição] **ENTÃO** o sistema **DEVE** [resposta].

---

## 7. Requisitos Funcionais

### ÉPICO 0 — Fundação & Infraestrutura

#### RF-0.1 — Estrutura do repositório e tooling · `2 SP` · **Must**
**História:** Como equipe, queremos um repositório padronizado com lint, formatação e hooks de commit, para que todos escrevam código consistente e a banca veja organização.
**Critérios de aceitação:**
1. QUANDO um desenvolvedor clona o projeto ENTÃO o sistema DEVE fornecer scripts padronizados de build, lint, test e dev.
2. QUANDO um commit é criado ENTÃO o sistema DEVE executar lint e formatação automaticamente (hook).
3. O repositório DEVE separar claramente `backend` (NestJS) e `frontend` (React).

#### RF-0.2 — Esqueleto do backend NestJS · `2 SP` · **Must**
**História:** Como equipe, queremos um backend NestJS inicializado com configuração por ambiente e health check, para servir de base às features.
**Critérios de aceitação:**
1. QUANDO a aplicação sobe ENTÃO o sistema DEVE expor um endpoint `/health` que retorna status 200.
2. O sistema DEVE carregar configurações sensíveis (chaves, URLs) a partir de variáveis de ambiente, nunca hardcoded.
3. SE uma variável de ambiente obrigatória estiver ausente ENTÃO o sistema DEVE falhar na inicialização com mensagem clara.

#### RF-0.3 — Esqueleto do frontend React · `2 SP` · **Must**
**História:** Como equipe, queremos um frontend React com roteamento e base de design system, para desenvolver telas rapidamente.
**Critérios de aceitação:**
1. QUANDO o app carrega ENTÃO o sistema DEVE renderizar uma rota inicial e permitir navegação entre páginas.
2. O sistema DEVE ter um tema base (cores, tipografia, espaçamentos) reutilizável.

#### RF-0.4 — Pipeline de CI · `3 SP` · **Must**
**História:** Como equipe, queremos CI que rode build, lint e testes a cada push, para evitar regressões e demonstrar maturidade técnica.
**Critérios de aceitação:**
1. QUANDO um push ou pull request é aberto ENTÃO o sistema DEVE executar build, lint e testes automaticamente.
2. SE qualquer etapa falhar ENTÃO o sistema DEVE marcar o pull request como reprovado.

#### RF-0.5 — Deploy inicial na AWS ("hello world") · `5 SP` · **Must**
**História:** Como equipe, queremos a infraestrutura de produção provisionada já na primeira semana, para eliminar o risco de deploy no fim do prazo.
**Critérios de aceitação:**
1. QUANDO o backend é publicado ENTÃO o sistema DEVE responder ao `/health` por uma URL pública de produção.
2. QUANDO o frontend é publicado ENTÃO o sistema DEVE ser acessível por uma URL pública com HTTPS.
3. O sistema DEVE ter um alarme de faturamento configurado na AWS desde o primeiro dia.
**Edge cases:** SE o certificado HTTPS não estiver pronto ENTÃO o time DEVE registrar como bloqueio prioritário; nenhuma feature depende da estética antes do `/health` público responder.

#### RF-0.6 — Modelagem de dados e migrations · `3 SP` · **Must**
**História:** Como equipe, queremos o esquema inicial do banco versionado por migrations, para evoluir a estrutura com segurança.
**Critérios de aceitação:**
1. QUANDO uma migration é aplicada ENTÃO o sistema DEVE criar/atualizar o esquema de forma idempotente e versionada.
2. O modelo DEVE contemplar, no mínimo, entidades de usuário, vaga, sessão de entrevista, pergunta/resposta e relatório.

---

### ÉPICO 1 — Autenticação & Onboarding

#### RF-1.1 — Login OAuth com GitHub · `5 SP` · **Must**
**História:** Como candidato, quero entrar com minha conta do GitHub, para que o sistema acesse meus repositórios sem eu gerenciar senhas.
**Critérios de aceitação:**
1. QUANDO o candidato clica em "Entrar com GitHub" ENTÃO o sistema DEVE iniciar o fluxo OAuth e solicitar apenas os escopos necessários para ler repositórios.
2. QUANDO o candidato autoriza ENTÃO o sistema DEVE criar (ou recuperar) sua conta e iniciar uma sessão autenticada.
3. SE o candidato negar a autorização ENTÃO o sistema DEVE retorná-lo à tela inicial com mensagem explicativa.
4. O sistema DEVE armazenar o token de acesso do GitHub de forma segura (criptografado em repouso), nunca exposto ao frontend.
**Edge cases:** SE o token do GitHub expirar ou for revogado ENTÃO o sistema DEVE detectar a falha ao acessar a API e solicitar nova autenticação.

#### RF-1.2 — Sessão e proteção de rotas (backend) · `3 SP` · **Must**
**História:** Como candidato, quero que apenas eu acesse meus dados, para garantir privacidade.
**Critérios de aceitação:**
1. QUANDO uma requisição atinge um recurso protegido sem sessão válida ENTÃO o sistema DEVE responder com 401.
2. QUANDO uma sessão é válida ENTÃO o sistema DEVE associar todas as operações ao usuário autenticado.
3. SE um usuário tentar acessar recurso de outro usuário ENTÃO o sistema DEVE responder com 403.

#### RF-1.3 — Contexto de autenticação e rotas protegidas (frontend) · `2 SP` · **Must**
**História:** Como candidato, quero ser redirecionado corretamente conforme meu estado de login, para uma navegação sem fricção.
**Critérios de aceitação:**
1. QUANDO um visitante acessa uma rota privada ENTÃO o sistema DEVE redirecioná-lo para o login.
2. QUANDO o candidato autenticado acessa a rota de login ENTÃO o sistema DEVE redirecioná-lo ao dashboard.

#### RF-1.4 — Perfil básico e onboarding · `2 SP` · **Should**
**História:** Como candidato, quero ver meu perfil e uma orientação inicial, para entender como usar a plataforma.
**Critérios de aceitação:**
1. QUANDO o candidato entra pela primeira vez ENTÃO o sistema DEVE exibir uma orientação curta (o que fazer) em no máximo 3 passos.
2. O sistema DEVE exibir nome de usuário e avatar vindos do GitHub.

#### RF-1.5 — Logout e renovação de sessão · `2 SP` · **Should**
**História:** Como candidato, quero encerrar minha sessão com segurança, para proteger minha conta em dispositivos compartilhados.
**Critérios de aceitação:**
1. QUANDO o candidato faz logout ENTÃO o sistema DEVE invalidar a sessão e redirecioná-lo à landing page.
2. SE a sessão expirar durante o uso ENTÃO o sistema DEVE informar e solicitar novo login sem perder dados já persistidos.

---

### ÉPICO 2 — Gestão de Vaga

#### RF-2.1 — Cadastro da descrição da vaga · `2 SP` · **Must**
**História:** Como candidato, quero informar a descrição da vaga que pretendo disputar, para que a entrevista seja direcionada a ela.
**Critérios de aceitação:**
1. QUANDO o candidato cola a descrição da vaga e confirma ENTÃO o sistema DEVE persistir o texto associado à sessão.
2. SE a descrição estiver vazia ou abaixo de um mínimo de caracteres ENTÃO o sistema DEVE exibir mensagem de validação.
3. SE a descrição exceder o limite máximo ENTÃO o sistema DEVE truncar ou avisar, sem quebrar o fluxo.

#### RF-2.2 — Parsing estruturado da vaga · `5 SP` · **Must**
**História:** Como candidato, quero que o sistema entenda a stack e a senioridade da vaga, para gerar perguntas realmente aderentes.
**Critérios de aceitação:**
1. QUANDO uma descrição é submetida ENTÃO o sistema DEVE extrair, via IA, ao menos: tecnologias/linguagens exigidas, nível de senioridade e competências-chave.
2. QUANDO a extração conclui ENTÃO o sistema DEVE persistir o resultado estruturado para uso pelo motor de entrevista.
3. SE a IA não conseguir identificar a stack ENTÃO o sistema DEVE seguir com um perfil genérico e sinalizar baixa confiança.
**Edge cases:** SE a descrição não for de uma vaga de tecnologia ENTÃO o sistema DEVE avisar que o conteúdo parece fora do escopo e permitir corrigir.

#### RF-2.3 — Histórico de vagas do candidato · `2 SP` · **Could**
**História:** Como candidato, quero reutilizar vagas cadastradas anteriormente, para não recolar a mesma descrição.
**Critérios de aceitação:**
1. QUANDO o candidato inicia uma nova sessão ENTÃO o sistema DEVE oferecer selecionar uma vaga já cadastrada ou criar nova.

---

### ÉPICO 3 — Integração com Repositórios GitHub

#### RF-3.1 — Listagem de repositórios · `3 SP` · **Must**
**História:** Como candidato, quero ver meus repositórios do GitHub, para escolher quais serão avaliados.
**Critérios de aceitação:**
1. QUANDO o candidato acessa a seleção de repositórios ENTÃO o sistema DEVE listar seus repositórios com nome, linguagem principal e visibilidade.
2. SE a API do GitHub atingir limite de requisições ENTÃO o sistema DEVE tratar o erro e exibir mensagem amigável com opção de tentar novamente.
3. QUANDO o candidato não possui repositórios ENTÃO o sistema DEVE exibir um estado vazio explicativo e permitir prosseguir sem repositórios.

#### RF-3.2 — Seleção de repositórios para a sessão · `2 SP` · **Must**
**História:** Como candidato, quero selecionar um ou mais repositórios, para direcionar o que a IA vai analisar.
**Critérios de aceitação:**
1. QUANDO o candidato seleciona repositórios e confirma ENTÃO o sistema DEVE associá-los à sessão de entrevista.
2. SE o candidato exceder um limite máximo de repositórios por sessão ENTÃO o sistema DEVE impedir a seleção adicional com aviso (controle de custo/latência).

#### RF-3.3 — Leitura inteligente do conteúdo do repositório · `8 SP` · **Must**
**História:** Como candidato, quero que a IA analise o que é relevante do meu código, para receber perguntas pertinentes sem que a análise fique cara ou lenta.
**Critérios de aceitação:**
1. QUANDO um repositório é selecionado ENTÃO o sistema DEVE obter a árvore de arquivos e selecionar um subconjunto relevante segundo heurística (relevância para a stack da vaga, exclusão de dependências/artefatos, respeito ao orçamento de tokens).
2. O sistema DEVE ignorar diretórios e arquivos irrelevantes (ex.: dependências, arquivos de lock, binários, artefatos de build).
3. SE o conteúdo relevante exceder o orçamento de tokens ENTÃO o sistema DEVE priorizar os arquivos mais representativos e registrar o que foi omitido.
4. QUANDO a leitura conclui ENTÃO o sistema DEVE armazenar em cache o conteúdo processado da sessão para evitar reprocessamento.
**Edge cases:** SE o repositório estiver vazio ou não tiver código reconhecível ENTÃO o sistema DEVE informar e permitir escolher outro repositório.

#### RF-3.4 — Cache de conteúdo de repositório · `3 SP` · **Should**
**História:** Como equipe, queremos evitar reprocessar o mesmo repositório, para reduzir custo de API e latência.
**Critérios de aceitação:**
1. QUANDO um repositório já processado é reutilizado ENTÃO o sistema DEVE reaproveitar o conteúdo em cache enquanto válido.
2. SE o cache estiver expirado ENTÃO o sistema DEVE reprocessar de forma transparente.

---

### ÉPICO 4 — Motor de Entrevista com IA *(núcleo e diferencial)*

#### RF-4.1 — Orquestração da sessão (máquina de estados) · `8 SP` · **Must**
**História:** Como candidato, quero uma entrevista com etapas coerentes (abertura, perguntas, encerramento), para uma experiência realista e controlada.
**Critérios de aceitação:**
1. QUANDO uma sessão inicia ENTÃO o sistema DEVE conduzi-la por estados bem definidos (ex.: preparando → em andamento → avaliando → concluída).
2. QUANDO o candidato responde uma pergunta ENTÃO o sistema DEVE avançar ao próximo passo previsto sem perder o histórico da sessão.
3. SE o processo de IA falhar no meio da sessão ENTÃO o sistema DEVE preservar o progresso e permitir retomar ou reiniciar a etapa.
4. O sistema DEVE persistir cada pergunta e resposta vinculadas à sessão.

#### RF-4.2 — Camada de abstração do provedor de IA · `5 SP` · **Must**
**História:** Como equipe, queremos trocar o modelo/provedor de IA sem reescrever a regra de negócio, para otimizar custo e demonstrar boa arquitetura.
**Critérios de aceitação:**
1. QUANDO uma funcionalidade precisa de IA ENTÃO o sistema DEVE consumi-la por uma interface única, independente do provedor concreto.
2. SE o provedor for trocado por configuração ENTÃO o sistema DEVE continuar funcionando sem alterações na regra de negócio.
3. SE o provedor retornar erro ou exceder tempo limite ENTÃO o sistema DEVE tratar a falha e, quando aplicável, tentar novamente com política definida.

#### RF-4.3 — Geração de perguntas de lógica/linguagem da vaga · `5 SP` · **Must**
**História:** Como candidato, quero perguntas de lógica na linguagem da vaga, para exercitar fundamentos técnicos exigidos.
**Critérios de aceitação:**
1. QUANDO a entrevista inicia ENTÃO o sistema DEVE gerar perguntas de lógica/fundamentos usando a linguagem/stack extraída da vaga.
2. QUANDO a stack da vaga muda entre sessões ENTÃO o sistema DEVE adaptar as perguntas à nova stack.

#### RF-4.4 — Geração de perguntas abertas de cenário · `3 SP` · **Must**
**História:** Como candidato, quero perguntas sobre como eu resolveria um problema real do dia a dia da vaga, para treinar raciocínio aplicado.
**Critérios de aceitação:**
1. QUANDO a entrevista está em andamento ENTÃO o sistema DEVE apresentar ao menos uma pergunta aberta descrevendo um cenário prático coerente com a vaga.

#### RF-4.5 — Perguntas sobre os projetos do repositório · `5 SP` · **Must**
**História:** Como candidato, quero explicar meus projetos e as decisões que tomei, para praticar o que será cobrado em entrevistas reais.
**Critérios de aceitação:**
1. QUANDO um repositório foi analisado ENTÃO o sistema DEVE gerar perguntas sobre o propósito do projeto e sobre decisões técnicas identificadas no código (ex.: padrão de arquitetura, escolha de biblioteca, estrutura adotada).
2. QUANDO o candidato responde ENTÃO o sistema DEVE poder aprofundar com uma pergunta de acompanhamento pertinente.

#### RF-4.6 — Análise de código: problemas e questionamento de decisões · `8 SP` · **Must**
**História:** Como candidato, quero que a IA aponte possíveis problemas no meu código e me questione sobre minhas escolhas, para eu chegar preparado a perguntas difíceis.
**Critérios de aceitação:**
1. QUANDO o código do repositório é analisado ENTÃO o sistema DEVE identificar possíveis erros ou más práticas e formular questionamentos sobre o porquê das decisões.
2. QUANDO a análise conclui ENTÃO o sistema DEVE produzir, no relatório final, uma avaliação da relevância dos projetos para o escopo da vaga.
3. SE o código não contiver problemas evidentes ENTÃO o sistema DEVE ainda assim questionar decisões de design de forma construtiva.
**Edge cases:** o sistema DEVE evitar afirmações categóricas incorretas — questionamentos devem ser formulados como perguntas, não como acusações definitivas.

#### RF-4.7 — Gestão de contexto e controle de custo · `5 SP` · **Must**
**História:** Como equipe, queremos manter o custo de API baixo sem perder qualidade, para respeitar a restrição de orçamento do projeto.
**Critérios de aceitação:**
1. QUANDO uma requisição de IA é montada ENTÃO o sistema DEVE respeitar um orçamento de tokens configurável.
2. O sistema DEVE reaproveitar contexto estável entre perguntas da mesma sessão (ex.: caching de prompt) sempre que o provedor suportar.
3. O sistema DEVE registrar métricas de consumo (tokens/estimativa de custo) por sessão para acompanhamento.

#### RF-4.8 — Interface de chat da entrevista (frontend) · `5 SP` · **Must**
**História:** Como candidato, quero conduzir a entrevista em uma interface de conversa clara, para focar nas respostas.
**Critérios de aceitação:**
1. QUANDO uma pergunta é gerada ENTÃO o sistema DEVE exibi-la de forma legível, com indicação de progresso da entrevista.
2. QUANDO o candidato envia uma resposta ENTÃO o sistema DEVE registrar e exibir o avanço para a próxima pergunta.
3. QUANDO a IA está processando ENTÃO o sistema DEVE exibir estado de carregamento adequado.
4. SE ocorrer erro na geração ENTÃO o sistema DEVE permitir tentar novamente sem perder o histórico visível.

#### RF-4.9 — Streaming das respostas da IA · `5 SP` · **Should**
**História:** Como candidato, quero ver a resposta da IA sendo escrita em tempo real, para uma experiência mais fluida e moderna.
**Critérios de aceitação:**
1. QUANDO a IA gera conteúdo longo ENTÃO o sistema DEVE exibir o texto progressivamente (streaming).
2. SE a conexão de streaming cair ENTÃO o sistema DEVE recuperar o resultado final por um caminho alternativo.

---

### ÉPICO 5 — Avaliação & Relatório Final

#### RF-5.1 — Avaliação das respostas por rubrica · `5 SP` · **Must**
**História:** Como candidato, quero uma avaliação estruturada das minhas respostas, para saber onde estou bem e onde preciso melhorar.
**Critérios de aceitação:**
1. QUANDO a entrevista é concluída ENTÃO o sistema DEVE avaliar as respostas segundo uma rubrica com dimensões definidas (ex.: lógica, domínio da stack, qualidade das decisões, comunicação).
2. QUANDO a avaliação conclui ENTÃO o sistema DEVE atribuir uma pontuação por dimensão e uma nota geral.
3. SE alguma dimensão não puder ser avaliada por falta de dados ENTÃO o sistema DEVE marcá-la como "não avaliada" em vez de penalizar arbitrariamente.

#### RF-5.2 — Análise de aderência projeto ↔ vaga · `5 SP` · **Must**
**História:** Como candidato, quero saber o quão aderente meu portfólio é à vaga, para direcionar meus estudos e reduzir minha insegurança.
**Critérios de aceitação:**
1. QUANDO os repositórios e a vaga foram processados ENTÃO o sistema DEVE produzir um indicador de aderência entre o portfólio e as exigências da vaga.
2. O sistema DEVE justificar o indicador com pontos concretos (o que aproxima e o que falta).

#### RF-5.3 — Composição do relatório final · `5 SP` · **Must**
**História:** Como candidato, quero um relatório claro com pontos fortes, lacunas e próximos passos, para saber exatamente o que estudar.
**Critérios de aceitação:**
1. QUANDO a avaliação conclui ENTÃO o sistema DEVE gerar um relatório contendo: resumo geral, pontos fortes, lacunas identificadas, aderência à vaga e recomendações acionáveis.
2. O sistema DEVE persistir o relatório vinculado à sessão.

#### RF-5.4 — Visualização do relatório · `5 SP` · **Must**
**História:** Como candidato, quero visualizar o relatório de forma agradável e compreensível, para absorver o feedback com facilidade.
**Critérios de aceitação:**
1. QUANDO o relatório está pronto ENTÃO o sistema DEVE exibir as pontuações por dimensão de forma visual (ex.: gráfico) e o texto das recomendações de forma legível.
2. QUANDO o candidato acessa uma sessão concluída ENTÃO o sistema DEVE reexibir o relatório correspondente.

#### RF-5.5 — Exportar relatório em PDF · `3 SP` · **Could**
**História:** Como candidato, quero exportar meu relatório, para guardá-lo ou revisá-lo offline.
**Critérios de aceitação:**
1. QUANDO o candidato solicita exportação ENTÃO o sistema DEVE gerar um arquivo do relatório para download.

---

### ÉPICO 6 — Histórico & Dashboard

#### RF-6.1 — Dashboard de sessões · `3 SP` · **Should**
**História:** Como candidato, quero ver minhas entrevistas anteriores, para acompanhar minha evolução.
**Critérios de aceitação:**
1. QUANDO o candidato acessa o dashboard ENTÃO o sistema DEVE listar suas sessões com vaga, data e nota geral.
2. QUANDO não há sessões ENTÃO o sistema DEVE exibir um estado vazio que convida a iniciar a primeira entrevista.

#### RF-6.2 — Revisão de sessão concluída · `3 SP` · **Should**
**História:** Como candidato, quero reabrir uma entrevista passada, para reler perguntas, respostas e feedback.
**Critérios de aceitação:**
1. QUANDO o candidato abre uma sessão concluída ENTÃO o sistema DEVE exibir o histórico de perguntas/respostas e o relatório associado.

---

### ÉPICO 7 — UX/UI & Polimento

#### RF-7.1 — Design system e identidade visual · `5 SP` · **Must**
**História:** Como candidato, quero uma interface consistente e profissional, para confiar na ferramenta.
**Critérios de aceitação:**
1. O sistema DEVE aplicar um conjunto coeso de componentes, cores e tipografia em todas as telas.

#### RF-7.2 — Landing page · `3 SP` · **Must**
**História:** Como visitante, quero entender rapidamente o que a ferramenta faz e por que ela importa, para decidir experimentá-la.
**Critérios de aceitação:**
1. QUANDO um visitante acessa a raiz ENTÃO o sistema DEVE apresentar a proposta de valor, a dor endereçada e um chamado para ação de login.

#### RF-7.3 — Responsividade e acessibilidade básica · `3 SP` · **Must**
**História:** Como candidato, quero usar a ferramenta em diferentes tamanhos de tela, para acessá-la onde for conveniente.
**Critérios de aceitação:**
1. QUANDO a aplicação é acessada em telas pequenas ENTÃO o sistema DEVE permanecer utilizável e legível.
2. O sistema DEVE respeitar práticas básicas de acessibilidade (contraste, foco de teclado, textos alternativos essenciais).

#### RF-7.4 — Estados de carregamento e erro · `3 SP` · **Must**
**História:** Como candidato, quero feedback claro quando algo está carregando ou falha, para não ficar perdido.
**Critérios de aceitação:**
1. QUANDO uma operação assíncrona está em curso ENTÃO o sistema DEVE exibir indicador de carregamento (ex.: skeleton/spinner).
2. SE uma operação falhar ENTÃO o sistema DEVE exibir mensagem de erro compreensível e, quando possível, uma ação de recuperação.

#### RF-7.5 — Microinterações e refino visual · `2 SP` · **Could**
**História:** Como candidato, quero uma experiência polida, para uma impressão positiva.
**Critérios de aceitação:**
1. O sistema DEVE incluir transições e microinterações que reforcem a fluidez, sem prejudicar o desempenho.

---

### ÉPICO 8 — Qualidade, Deploy Final & Entrega

#### RF-8.1 — Testes automatizados · `5 SP` · **Must (núcleo) / Should (ampliação)**
**História:** Como equipe, queremos testes cobrindo a lógica crítica, para demonstrar qualidade técnica e evitar regressões.
**Critérios de aceitação:**
1. O sistema DEVE ter testes unitários cobrindo as regras críticas do motor de entrevista e da avaliação.
2. O sistema DEVE ter ao menos um teste ponta a ponta do fluxo principal (login → vaga → repositórios → entrevista → relatório).

#### RF-8.2 — Deploy de produção final · `5 SP` · **Must**
**História:** Como equipe, queremos a versão final publicada e estável na AWS, para atender ao requisito de deploy funcional do edital.
**Critérios de aceitação:**
1. QUANDO a versão final é publicada ENTÃO o sistema DEVE estar acessível por URL pública com HTTPS e fluxo principal funcional.
2. O sistema DEVE manter as chaves e segredos fora do código-fonte, carregados por variáveis de ambiente no ambiente de produção.

#### RF-8.3 — Observabilidade básica e alarme de custo · `2 SP` · **Must**
**História:** Como equipe, queremos monitorar saúde e gastos, para evitar surpresas de indisponibilidade ou fatura.
**Critérios de aceitação:**
1. O sistema DEVE registrar logs de erros do backend em produção.
2. O sistema DEVE manter um alarme de faturamento ativo na AWS.

#### RF-8.4 — Dados fictícios e conformidade LGPD · `2 SP` · **Must**
**História:** Como equipe, queremos usar apenas dados fictícios em testes/demonstrações, para cumprir o código de conduta e a LGPD exigidos pelo edital.
**Critérios de aceitação:**
1. O sistema DEVE utilizar exclusivamente dados fictícios (mockados) para demonstração/testes.
2. O sistema NÃO DEVE capturar, armazenar ou expor dados pessoais reais de terceiros.
3. QUANDO dados do candidato são armazenados ENTÃO o sistema DEVE limitar-se ao necessário para a funcionalidade.

#### RF-8.5 — README e documentação de autoria · `2 SP` · **Must**
**História:** Como equipe, queremos um README que explique a aplicação e a contribuição de cada integrante, para cumprir a exigência do edital.
**Critérios de aceitação:**
1. O README DEVE explicar claramente a aplicação desenvolvida.
2. O README DEVE detalhar a função e as responsabilidades de cada membro da equipe.
3. SE a equipe utilizar IA no desenvolvimento ENTÃO o README DEVE registrar quais ferramentas foram usadas e em quais etapas.

#### RF-8.6 — Pitch gravado · `3 SP` · **Must**
**História:** Como equipe, queremos um pitch claro dentro do tempo, para pontuar no critério de apresentação.
**Critérios de aceitação:**
1. O vídeo DEVE ter entre 3 e 5 minutos, hospedado em link do Google Drive com acesso público.
2. O vídeo DEVE apresentar a proposta, a dor de mercado, as tecnologias e uma demonstração da aplicação funcionando.

#### RF-8.7 — Limite de sessões configurável por ambiente · `2 SP` · **Must**
**História:** Como equipe, queremos limitar a quantidade de sessões de entrevista por usuário na versão final, para controlar o custo de API sem restringir o desenvolvimento e os testes.
**Critérios de aceitação:**
1. O sistema DEVE expor o limite máximo de sessões por usuário como parâmetro de configuração (variável de ambiente), não como valor fixo no código.
2. QUANDO o ambiente é de desenvolvimento ENTÃO o sistema DEVE operar **sem limite** de sessões (parâmetro desativado ou nulo).
3. QUANDO o ambiente é de produção/demonstração ENTÃO o sistema DEVE aplicar o limite configurado.
4. SE o candidato atingir o limite configurado ENTÃO o sistema DEVE impedir novas sessões e exibir mensagem explicativa, preservando o acesso ao histórico já existente.
**Edge cases:** SE o limite for alterado em produção ENTÃO o sistema DEVE passar a valer para novas sessões, sem afetar sessões já concluídas.

---

## 8. Requisitos Não-Funcionais

- **RNF-1 (Desempenho):** QUANDO o candidato realiza uma ação de navegação comum ENTÃO o sistema DEVE responder em tempo perceptivelmente ágil; operações dependentes de IA DEVEM exibir estado de carregamento e não bloquear a interface.
- **RNF-2 (Custo):** o sistema DEVE operar dentro do orçamento gratuito/creditado de infraestrutura durante o hackathon e usar modelos de IA de baixo custo com controle de tokens (ver plano de desenvolvimento).
- **RNF-3 (Segurança):** segredos DEVEM ser mantidos em variáveis de ambiente; o token do GitHub DEVE ser armazenado criptografado e nunca exposto ao cliente; rotas privadas DEVEM exigir autenticação.
- **RNF-4 (Privacidade/LGPD):** conforme RF-8.4, apenas dados fictícios em demonstração; coleta mínima de dados do próprio usuário.
- **RNF-5 (Usabilidade):** o fluxo principal DEVE ser concluível em poucos passos, com estados de erro e carregamento sempre tratados.
- **RNF-6 (Confiabilidade):** falhas de APIs externas (GitHub, IA) DEVEM ser tratadas com mensagens claras e, quando aplicável, retentativa.
- **RNF-7 (Observabilidade):** o sistema DEVE registrar erros em produção e manter alarme de custo.
- **RNF-8 (Portabilidade do provedor de IA):** o modelo/provedor DEVE ser substituível por configuração, sem alterar regra de negócio.
- **RNF-9 (Manutenibilidade):** o código DEVE seguir padrão de lint/formatação e organização modular consistente.

## 9. Restrições e Premissas

- **Restrição técnica:** backend em NestJS, frontend em React, deploy obrigatório na AWS.
- **Restrição de custo:** minimizar gastos com infraestrutura e APIs sem comprometer a qualidade.
- **Restrição de prazo:** desenvolvimento entre 16/07 e 15/08; entrega em 16/08.
- **Premissa:** o candidato possui conta no GitHub com ao menos um repositório com código (o fluxo também funciona sem repositórios, com menor personalização).
- **Premissa:** o relatório final é produzido em **português**, independentemente do idioma da vaga ou do código analisado.
- **Confirmado:** a AWS foi validada junto à organização como plataforma de deploy aceita pelo edital.
- **Pendente de decisão:** o provedor/modelo de IA ainda não foi escolhido pela equipe. Ver seção 9 (Restrições e Premissas) e o plano de desenvolvimento para critérios de escolha (custo, nível gratuito, qualidade) — a camada de abstração de IA (RF-4.2) existe justamente para que essa decisão possa ser tomada, testada e revertida sem custo de retrabalho.

## 10. Fora de Escopo

- Suporte a GitLab e outros provedores de repositório.
- Execução/compilação real de código do candidato (live coding com sandbox).
- Colaboração multiusuário ou funcionalidades de recrutador.
- Cobrança, planos pagos e monetização.
- Aplicativo móvel nativo.

## 11. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Projeto ser percebido como "apenas um wrapper de IA" | Perda de pontos técnicos | Investir em arquitetura visível: seleção inteligente de arquivos, abstração de provedor, máquina de estados, testes e controle de custo. |
| Custo de API ao analisar repositórios grandes | Estouro de orçamento | Orçamento de tokens, seleção inteligente, caching de prompt e de conteúdo, modelo de baixo custo. |
| Limite de requisições da API do GitHub | Falha na listagem/leitura | Tratamento de rate limit, cache e mensagens de retentativa. |
| Deploy na AWS deixado para o fim | Risco de desclassificação (mesmo com a AWS confirmada como plataforma válida, o critério de desclassificação é sobre o deploy estar **funcional**) | Provisionar produção na Semana 1 (RF-0.5) e manter deploy contínuo. |
| Avaliação da IA inconsistente | Feedback pouco confiável | Rubrica explícita, dimensões marcáveis como "não avaliadas", prompts calibrados. |
| Escopo excessivo para o prazo | Entrega incompleta | Priorização MoSCoW rígida; Must primeiro, Should/Could apenas com folga. |

## 12. Questões em Aberto

1. Qual provedor/modelo de IA será adotado (impacta custo, nível gratuito e latência)? Ver critérios de escolha no plano de desenvolvimento.
2. Qual o valor exato do limite de sessões por usuário a ser aplicado na versão final/pública (RF-8.7)? Definir com base no consumo observado durante o desenvolvimento.

## 13. Resumo de Esforço

Estimativa por épico (pontos totais; a coluna "Must" indica o subconjunto do MVP):

| Épico | Total (SP) | Must (SP) |
|---|---|---|
| 0 — Fundação & Infraestrutura | 17 | 17 |
| 1 — Autenticação & Onboarding | 14 | 10 |
| 2 — Gestão de Vaga | 9 | 7 |
| 3 — Integração com Repositórios | 16 | 13 |
| 4 — Motor de Entrevista com IA | 44 | 39 |
| 5 — Avaliação & Relatório | 22 | 20 |
| 6 — Histórico & Dashboard | 8 | 0 |
| 7 — UX/UI & Polimento | 16 | 14 |
| 8 — Qualidade, Deploy & Entrega | 21 | 20 |
| **Total** | **≈ 167** | **≈ 140** |

> O MVP (≈138 SP) representa o fluxo ponta a ponta que a banca precisa ver funcionando. Os ≈27 SP restantes (Should/Could) são incrementos que elevam a nota e só devem ser puxados após o MVP estar estável. A calibração de capacidade e o cronograma estão no documento de plano de desenvolvimento.