import type {
  InterviewQuestion,
  InterviewReport,
  InterviewSession,
  InterviewSessionSummary,
} from "@lib/interview-api";
import type { RepoSummary } from "@lib/repositories-api";
import type { ParsedVacancyProfile } from "@lib/vacancies-api";

/** Dados fictícios usados no modo demonstração. Nada aqui toca o backend. */

export const demoUser = {
  id: "demo-user-0001",
  username: "mariana-dev",
  email: "mariana@exemplo.dev",
  avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
};

export const demoVacancyId = "8f14e45f-ceea-467a-9b47-2c0e5d5f1a20";
export const demoSessionId = "3c9a1e7b-2f44-4c2e-8f0d-71b6a2c5d913";

export const demoVacancyDescription = `Desenvolvedor(a) Full-Stack Júnior — Acme Tecnologia (São Paulo · híbrido)

Procuramos uma pessoa desenvolvedora júnior para o time de Plataforma. Você vai construir features de ponta a ponta no nosso produto de gestão financeira para PMEs.

O que você vai fazer:
• Desenvolver interfaces em React com TypeScript
• Criar e manter APIs REST em Node.js (NestJS)
• Modelar dados em PostgreSQL
• Escrever testes automatizados (Jest) e participar de code reviews

O que esperamos:
• Projetos práticos com React, Node.js e TypeScript (projetos pessoais contam!)
• Noções de SQL e Git no dia a dia
• Boa comunicação e vontade de aprender

Diferenciais: Docker, AWS, testes E2E (Playwright).`;

export const demoVacancyProfile: ParsedVacancyProfile = {
  technologies: [
    "React",
    "TypeScript",
    "Node.js",
    "NestJS",
    "PostgreSQL",
    "Jest",
    "Docker",
  ],
  seniorityLevel: "junior",
  keyCompetencies: [
    "Desenvolvimento full-stack",
    "APIs REST",
    "Modelagem de dados",
    "Testes automatizados",
    "Code review",
  ],
  confidence: "high",
  outOfScope: false,
};

export const demoRepositories: RepoSummary[] = [
  {
    id: 501,
    owner: "mariana-dev",
    name: "api-ecommerce",
    description:
      "API REST de e-commerce em Node.js + Express com PostgreSQL, autenticação JWT e testes com Jest.",
    language: "JavaScript",
    visibility: "public",
  },
  {
    id: 502,
    owner: "mariana-dev",
    name: "dashboard-financeiro",
    description:
      "Painel em React + TypeScript com gráficos de fluxo de caixa e integração com API própria.",
    language: "TypeScript",
    visibility: "public",
  },
  {
    id: 503,
    owner: "mariana-dev",
    name: "estudos-algoritmos",
    description: "Resolução comentada de exercícios de estruturas de dados e algoritmos.",
    language: "Python",
    visibility: "public",
  },
  {
    id: 504,
    owner: "mariana-dev",
    name: "portfolio-site",
    description: "Site pessoal estático, feito para praticar acessibilidade e performance.",
    language: "HTML",
    visibility: "public",
  },
];

/** Repositório que o piloto automático seleciona. */
export const demoSelectedRepo = demoRepositories[0];

export const demoRepoAnalysis = {
  fileCount: 34,
  omittedCount: 128,
  topFiles: [
    "src/routes/orders.js",
    "src/services/order.service.js",
    "src/db/queries/orders.sql",
    "tests/orders.spec.js",
  ],
};

interface DemoQuestion {
  question: Omit<InterviewQuestion, "answer">;
  /** Resposta que o piloto automático "digita". */
  answer: string;
}

export const demoQuestions: DemoQuestion[] = [
  {
    question: {
      id: "q-1",
      orderIndex: 1,
      type: "code_analysis",
      content:
        "Nesse trecho do api-ecommerce você faz uma consulta ao banco para cada pedido da lista. O que te levou a essa abordagem, e como ela se comporta com 10 mil pedidos?",
      metadata: {
        codeFile: "src/services/order.service.js",
        codeExcerpt: `for (const order of orders) {
  order.items = await Item.find({ orderId: order.id });
}`,
      },
    },
    answer:
      "Comecei assim porque era o mais direto de ler, mas é um N+1: com 10 mil pedidos são 10 mil idas ao banco. Hoje eu buscaria todos os itens de uma vez com um WHERE orderId IN (...) e agruparia em memória por orderId — uma query só, e o tempo passa a ser praticamente constante.",
  },
  {
    question: {
      id: "q-2",
      orderIndex: 2,
      type: "scenario",
      content:
        "A vaga pede APIs em NestJS com PostgreSQL. Imagine que o endpoint de fechamento de pedido precisa debitar o estoque e registrar o pagamento. Como você garante que os dois aconteçam juntos?",
      metadata: null,
    },
    answer:
      "Colocaria as duas escritas na mesma transação do banco: abro a transação, debito o estoque, gravo o pagamento e só então dou commit — se qualquer passo falhar, rollback. No NestJS eu faria isso num service com o transaction manager do ORM, e deixaria o endpoint idempotente com uma chave do pedido pra reenvio não duplicar cobrança.",
  },
  {
    question: {
      id: "q-3",
      orderIndex: 3,
      type: "logic",
      content:
        "Como você encontraria, em uma lista de transações, o primeiro valor que se repete — e qual o custo dessa solução?",
      metadata: null,
    },
    answer:
      "Percorro a lista uma vez guardando os valores já vistos num Set. No momento em que um valor já está no Set, ele é o primeiro repetido e eu retorno. É O(n) de tempo e O(n) de memória, bem melhor que comparar todos contra todos, que seria O(n²).",
  },
  {
    question: {
      id: "q-4",
      orderIndex: 4,
      type: "project",
      content:
        "No dashboard-financeiro você escreveu testes só para a camada de serviços. Como você decidiria o que testar num projeto novo desse time?",
      metadata: null,
    },
    answer:
      "Priorizaria as regras de negócio que doem se quebrarem — cálculo de saldo e fechamento de caixa — com testes unitários rápidos, e cobriria os fluxos críticos ponta a ponta com um teste de integração por endpoint. Componente de UI eu testaria por comportamento, não por implementação, pra não travar refatoração.",
  },
];

export function buildDemoSession(
  answers: Record<string, string> = {},
): InterviewSession {
  return {
    id: demoSessionId,
    status: Object.keys(answers).length === demoQuestions.length ? "completed" : "in_progress",
    vacancyId: demoVacancyId,
    repo: {
      fullName: `${demoSelectedRepo.owner}/${demoSelectedRepo.name}`,
      url: `https://github.com/${demoSelectedRepo.owner}/${demoSelectedRepo.name}`,
      primaryLanguage: demoSelectedRepo.language,
    },
    repoAnalysis: demoRepoAnalysis,
    questions: demoQuestions.map(({ question }) => ({
      ...question,
      answer: answers[question.id]
        ? { content: answers[question.id], createdAt: new Date().toISOString() }
        : null,
    })),
  };
}

export const demoReport: InterviewReport = {
  sessionId: demoSessionId,
  overallScore: 78,
  adherenceScore: 72,
  adherenceNotes: [
    {
      title: "Stack alinhada.",
      text: "Seus projetos usam Node.js, React e PostgreSQL — exatamente o tripé pedido na vaga.",
    },
    {
      title: "Falta Docker no portfólio.",
      text: "A vaga cita containers como diferencial e nenhum repositório seu tem Dockerfile.",
    },
  ],
  dimensionScores: [
    { label: "Clareza técnica", score: 84 },
    { label: "Análise de código", score: 80 },
    { label: "Modelagem de dados", score: 71 },
    { label: "Testes", score: 66 },
    { label: "Comunicação", score: 88 },
  ],
  strengths: [
    {
      title: "Diagnóstico do N+1.",
      text: "Você identificou o problema no seu próprio código e propôs a consulta agregada sem rodeios.",
    },
    {
      title: "Transações bem explicadas.",
      text: "Commit, rollback e idempotência apareceram no lugar certo, com vocabulário de quem já sofreu na prática.",
    },
    {
      title: "Custo computacional na ponta da língua.",
      text: "Comparou O(n) e O(n²) justificando a escolha de estrutura de dados.",
    },
  ],
  gaps: [
    {
      title: "Cobertura de testes rasa.",
      text: "Os testes do portfólio param na camada de serviço; a vaga espera Jest também nos fluxos de API.",
    },
    {
      title: "Sem containers.",
      text: "Docker aparece como diferencial e você não citou experiência com ambientes containerizados.",
    },
  ],
  recommendations: [
    {
      title: "Adicione um teste de integração.",
      text: "Um único teste ponta a ponta no fluxo de pedidos do api-ecommerce já muda a conversa numa entrevista.",
    },
    {
      title: "Containerize o api-ecommerce.",
      text: "Um Dockerfile e um docker-compose com PostgreSQL cobrem o diferencial pedido em uma tarde.",
    },
    {
      title: "Documente a decisão do N+1.",
      text: "Registre a otimização no README: mostrar o antes e depois vale mais que o código sozinho.",
    },
  ],
  createdAt: new Date().toISOString(),
};

/** Entrevistas anteriores mostradas no dashboard. */
export const demoPastSessions: InterviewSessionSummary[] = [
  {
    id: "b1c2d3e4-1111-4a2b-9c3d-4e5f60718293",
    status: "completed",
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 86_400_000 + 1_500_000).toISOString(),
    vacancy: { seniorityLevel: "junior", technologies: ["React", "TypeScript"] },
    repo: { fullName: "mariana-dev/dashboard-financeiro" },
    questionCount: 4,
    report: { overallScore: 71, adherenceScore: 65 },
  },
  {
    id: "c2d3e4f5-2222-4b3c-8d4e-5f6071829304",
    status: "completed",
    createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    completedAt: new Date(Date.now() - 9 * 86_400_000 + 1_800_000).toISOString(),
    vacancy: { seniorityLevel: "intern", technologies: ["Node.js", "PostgreSQL"] },
    repo: { fullName: "mariana-dev/api-ecommerce" },
    questionCount: 4,
    report: { overallScore: 63, adherenceScore: 58 },
  },
];

/** Mensagens de progresso do preparo da entrevista (stream NDJSON). */
export const demoProgressMessages = [
  "Lendo o repositório mariana-dev/api-ecommerce...",
  "34 arquivos relevantes selecionados (128 ignorados).",
  "Cruzando o código com o perfil da vaga...",
  "Escrevendo 4 perguntas sob medida...",
];
