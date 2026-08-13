import { Container } from "../ui/Container";
import { Eyebrow } from "../ui/Eyebrow";
import { CheckIcon } from "../ui/icons";
import { cn } from "../../lib/cn";

interface Highlight {
  label: string;
  tone: "trail" | "ember";
}

const highlights: Highlight[] = [
  { label: "Perguntas de lógica na linguagem da vaga", tone: "trail" },
  { label: "Cenários do dia a dia de um time real", tone: "trail" },
  { label: "Análise das decisões técnicas no seu código", tone: "trail" },
];

function InterviewPreview() {
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3.5 justify-self-center rounded-[16px] border border-border bg-surface p-5.5 shadow-md">
      <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
        <span className="size-2 rounded-full bg-trail-500" />
        entrevista ao vivo · pergunta 3 de 8
      </div>

      <div className="overflow-hidden rounded-md border border-code-border bg-code">
        <div className="border-b border-code-border px-3.5 py-2 font-mono text-[11px] text-slate-500">
          api-ecommerce · src/routes/orders.js
        </div>
        <pre className="overflow-x-auto px-3.5 py-3 font-mono text-xs leading-[1.7] text-slate-300">
          router.<span className="text-ember-300">get</span>(
          <span className="text-trail-300">'/orders'</span>,{" "}
          <span className="text-q-scenario">async</span> (req, res) =&gt;{" "}
          {"{\n"}
          {"  "}
          <span className="text-q-scenario">const</span> orders ={" "}
          <span className="text-q-scenario">await</span> Order.
          <span className="text-ember-300">find</span>(
          {"{ userId: req.user.id }"});{"\n"}
          {"  "}
          <span className="text-q-scenario">for</span> (
          <span className="text-q-scenario">const</span> order{" "}
          <span className="text-q-scenario">of</span> orders) {"{\n"}
          {"    "}order.items = <span className="text-q-scenario">await</span>{" "}
          Item.
          <span className="text-ember-300">find</span>({"{ orderId: order.id }"}
          );{"\n"}
          {"  }\n"}
          {"});"}
        </pre>
      </div>

      <div className="rounded-[4px_14px_14px_14px] border border-border bg-surface-2 px-4 py-3 text-sm leading-[1.55]">
        Notei que cada pedido dispara uma nova consulta. O que te levou a essa
        escolha — e como você a otimizaria hoje?
      </div>
      <div className="max-w-[85%] self-end rounded-[14px_4px_14px_14px] border border-[--alpha(var(--color-trail-500)/30%)] bg-[--alpha(var(--color-trail-500)/12%)] px-4 py-3 text-sm leading-[1.55]">
        Na época priorizei clareza, mas hoje vejo o N+1. Faria uma única
        consulta com <span className="font-mono text-[12.5px]">$in</span> nos
        ids dos pedidos…
      </div>
    </div>
  );
}

export function DifferenceSection() {
  return (
    <section className="border-t border-border">
      <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-center gap-14 py-20">
        <div>
          <Eyebrow tone="ember">O diferencial</Eyebrow>
          <h2 className="mt-3 mb-4 font-display text-[clamp(1.7rem,3.4vw,2.2rem)] font-semibold tracking-[-0.02em] text-pretty">
            Não é mais um quiz de algoritmos.
          </h2>
          <p className="mb-7 max-w-[54ch] text-fg-2 text-pretty">
            Plataformas genéricas te treinam para inverter árvores binárias.
            Entrevistadores de verdade perguntam{" "}
            <b className="text-fg">por que você tomou as decisões que tomou</b>.
            O InterviewTrail lê seus repositórios e faz as perguntas difíceis
            antes do recrutador.
          </p>

          <ul className="flex list-none flex-col gap-3.5 p-0">
            {highlights.map((highlight) => (
              <li key={highlight.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-[22px] flex-none items-center justify-center rounded-full",
                    highlight.tone === "trail"
                      ? "bg-[--alpha(var(--color-trail-500)/15%)] text-trail-500"
                      : "bg-[--alpha(var(--color-ember-400)/16%)] text-ember-400",
                  )}
                >
                  <CheckIcon />
                </span>
                <span className="text-[15px]">{highlight.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <InterviewPreview />
      </Container>
    </section>
  );
}
