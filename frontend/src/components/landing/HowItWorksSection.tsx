import { Container } from "../ui/Container";
import { Eyebrow } from "../ui/Eyebrow";
import { cn } from "../../lib/cn";
import { sectionIds } from "../../routes/paths";

interface Step {
  number: string;
  title: string;
  description: string;
  tone: "trail" | "ember";
}

const steps: Step[] = [
  {
    number: "01",
    title: "Cole a vaga",
    description:
      "A IA lê a descrição e extrai stack, senioridade e competências-chave.",
    tone: "trail",
  },
  {
    number: "02",
    title: "Escolha seus repositórios",
    description:
      "Você decide quais projetos entram na análise. Até 3 por sessão — nada é publicado.",
    tone: "trail",
  },
  {
    number: "03",
    title: "Faça a entrevista",
    description:
      "Perguntas sob medida, no seu ritmo. No final, um relatório honesto do que praticar.",
    tone: "ember",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id={sectionIds.howItWorks}
      className="scroll-mt-16 border-t border-border"
    >
      <Container className="py-20">
        <Eyebrow>Como funciona</Eyebrow>
        <h2 className="mt-3 mb-2 font-display text-[clamp(1.7rem,3.4vw,2.2rem)] font-semibold tracking-[-0.02em]">
          Uma trilha com três marcos.
        </h2>
        <p className="mb-12 max-w-[56ch] text-fg-2">
          Da vaga ao diagnóstico em uma sessão de vinte minutos.
        </p>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute top-6 right-[16.6%] left-[16.6%] hidden h-[3px] rounded-sm bg-border md:block"
          >
            <div className="h-full w-full rounded-sm bg-gradient-to-r from-trail-500 to-ember-400 opacity-50" />
          </div>

          <ol className="grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-8 p-0">
            {steps.map((step) => (
              <li
                key={step.number}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div
                  className={cn(
                    "relative z-1 flex size-12 items-center justify-center rounded-full",
                    "border-2 bg-surface font-mono text-sm font-semibold",
                    step.tone === "trail"
                      ? "border-trail-500 text-trail-text"
                      : "border-ember-400 text-ember-text",
                  )}
                >
                  {step.number}
                </div>
                <div>
                  <h3 className="mb-2 font-display text-[1.15rem] font-semibold">
                    {step.title}
                  </h3>
                  <p className="max-w-[30ch] text-[14.5px] text-fg-2">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
