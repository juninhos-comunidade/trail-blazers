# Modo demonstração (pitch)

Branch `demo/pitch-auto-run`. Serve para mostrar o produto rodando de ponta a
ponta em ~40 segundos, sem ninguém tocar no teclado e sem depender do backend,
do GitHub ou da API de IA.

## Como usar no pitch

```bash
npm run dev:frontend    # sobe o Vite em http://localhost:3001
```

Abra `http://localhost:3001` e não faça nada. O fluxo inteiro acontece sozinho:

| Etapa | Começa em |
| --- | --- |
| Landing page (rolagem pelas seções) | 0s |
| Dashboard com entrevistas anteriores | ~5s |
| Descrição da vaga sendo digitada + análise da IA | ~7s |
| Escolha do repositório + preparo da entrevista | ~15s |
| Entrevista: 4 perguntas respondidas no chat | ~20s |
| Relatório final (nota 78, aderência 72%) | ~35s |
| Fim, e reinício automático | ~40s |

Um cursor branco mostra onde o "usuário" está clicando e um selo no canto
inferior esquerdo indica a etapa e o tempo decorrido.

Dicas para o palco: rode em tela cheia (F11) e recarregue a página para começar
de novo a qualquer momento.

## Chaves na URL

| URL | Efeito |
| --- | --- |
| `http://localhost:3001/` | demo automática, reiniciando em loop (padrão) |
| `http://localhost:3001/?demo=once` | roda uma vez e para no relatório |
| `http://localhost:3001/?demo=off` | desliga a demo nesta aba — app real, backend real |
| `http://localhost:3001/?demo=on` | liga de novo |

Também dá para desligar no build todo com `VITE_DEMO_MODE=false`.

## Como funciona

Tudo vive em `frontend/src/demo/` e é ligado em dois pontos (`main.tsx` e
`App.tsx`). Nenhuma tela, rota ou regra do produto foi alterada — a demo usa a
interface de verdade.

| Arquivo | Papel |
| --- | --- |
| `demo-flag.ts` | decide se a demo está ligada e se reinicia no fim |
| `demo-boot.ts` | roda antes do React: instala o backend falso, "loga" o usuário e desliga o TTS |
| `demo-api.ts` | substitui `window.fetch` nas chamadas da API, com latências curtas e stream de progresso |
| `demo-data.ts` | os dados fictícios (vaga, repositórios, perguntas, respostas, relatório) |
| `demo-dom.ts` | digitação, rolagem, cursor falso e cliques |
| `demo-script.ts` | o roteiro e todos os tempos (`TIMELINE`) |
| `DemoAutopilot.tsx` | dispara o roteiro e desenha o selo de progresso |

Para acelerar ou desacelerar qualquer trecho, mexa em `TIMELINE` no
`demo-script.ts` e nas latências (`LATENCY`) do `demo-api.ts`.

O usuário da demo é fictício (`mariana-dev`) e o token JWT é montado localmente:
nada é enviado para o backend, e o `?demo=off` limpa o modo demonstração.
