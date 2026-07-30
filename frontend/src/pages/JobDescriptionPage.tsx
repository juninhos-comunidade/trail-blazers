import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { InterviewStepper } from "@components/app/InterviewStepper";
import { MockScreenHeader } from "@components/mock/MockBanner";
import { Button, ButtonLink } from "@components/ui/Button";
import { CheckIcon } from "@components/ui/icons";
import { mockJobAnalysis, sampleJob } from "@mocks/interview-mock";
import { paths } from "@routes/paths";

type AnalysisStatus = "idle" | "analyzing" | "done";

export function JobDescriptionPage() {
  const navigate = useNavigate();
  const [jobText, setJobText] = useState("");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const analyze = (text: string) => {
    if (!text.trim()) return;
    setStatus("analyzing");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("done"), 1300);
  };

  const onChange = (text: string) => {
    setJobText(text);
    // Editar a vaga invalida a análise anterior.
    if (status !== "idle") setStatus("idle");
  };

  const useSample = () => {
    setJobText(sampleJob);
    analyze(sampleJob);
  };

  return (
    <div className="min-h-screen animate-rise">
      <MockScreenHeader screen="descrição da vaga" label="Nova entrevista" />

      <main className="mx-auto w-full max-w-[760px] px-4 pt-8 pb-14 sm:px-6 sm:pt-10 sm:pb-18">
        <InterviewStepper current={1} className="mb-12" />

        <h1 className="mb-2 font-display text-[clamp(1.5rem,3vw,1.9rem)] font-semibold tracking-[-0.02em]">
          Sobre qual vaga vamos treinar?
        </h1>
        <p className="mb-6 text-[15px] text-fg-2">
          Cole a descrição completa — quanto mais contexto, melhor a entrevista.
        </p>

        <textarea
          value={jobText}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Cole aqui a descrição da vaga…"
          aria-label="Descrição da vaga"
          className="min-h-[220px] w-full resize-y rounded-xl border border-border bg-surface px-4.5 py-4 text-[14.5px] leading-[1.6] text-fg transition-[border-color,box-shadow] duration-200 focus:border-trail-500 focus:shadow-[0_0_0_3px_--alpha(var(--color-trail-500)/20%)] focus:outline-none"
        />

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[11.5px] text-fg-muted">
            {jobText.length > 0 ? `${jobText.length} caracteres` : ""}
          </span>
          <button
            type="button"
            onClick={useSample}
            className="rounded-full border border-dashed border-border px-3.5 py-1.5 font-mono text-[11.5px] text-fg-2 transition-colors duration-200 hover:border-trail-500 hover:text-trail-text"
          >
            Usar vaga de exemplo
          </button>
        </div>

        {status === "idle" && jobText.trim().length > 0 && (
          <div className="mt-5">
            <Button onClick={() => analyze(jobText)}>Analisar vaga</Button>
          </div>
        )}

        {status === "analyzing" && <AnalyzingCard />}
        {status === "done" && <AnalysisCard />}

        <div className="mt-9 flex flex-wrap justify-between gap-3">
          <ButtonLink to={paths.dashboard} variant="ghost">
            ← Voltar
          </ButtonLink>

          <Button
            onClick={() => navigate(paths.repoChooser)}
            disabled={status !== "done"}
            className="max-sm:w-full"
          >
            Continuar →
          </Button>
        </div>
      </main>
    </div>
  );
}

function ShimmerPill({ width }: { width: number }) {
  return (
    <div
      style={{ width }}
      className="h-[30px] animate-shimmer rounded-full bg-[linear-gradient(90deg,var(--color-surface-2)_25%,var(--color-border)_37%,var(--color-surface-2)_63%)] bg-[length:400%_100%]"
    />
  );
}

function AnalyzingCard() {
  return (
    <div
      aria-label="Analisando a vaga"
      className="mt-7 rounded-lg border border-border bg-surface p-5.5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="size-4 animate-spin rounded-full border-2 border-border border-t-trail-500" />
        <span className="font-mono text-xs text-fg-2">Lendo a vaga…</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {[90, 110, 130, 80].map((width) => (
          <ShimmerPill key={width} width={width} />
        ))}
      </div>
    </div>
  );
}

function AnalysisCard() {
  return (
    <div className="mt-7 animate-rise rounded-lg border border-border bg-surface p-5.5">
      <div className="mb-4.5 flex items-center gap-2 text-trail-text">
        <CheckIcon size={14} />
        <span className="font-mono text-xs tracking-[0.08em] uppercase">
          Entendemos a vaga assim
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-fg-muted">
            Stack detectada
          </p>
          <div className="flex flex-wrap gap-2">
            {mockJobAnalysis.stack.map((item) => (
              <span
                key={item.name}
                className="inline-flex items-center gap-[7px] rounded-full border border-border bg-surface-2 px-3 py-[5px] font-mono text-[12.5px] font-medium"
              >
                <i
                  aria-hidden="true"
                  className="inline-block size-[9px] rounded-full"
                  style={{ background: item.color }}
                />
                {item.name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-medium text-fg-muted">
            Senioridade
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[--alpha(var(--color-info)/15%)] px-3 py-[5px] text-[13px] font-medium text-info">
            <i
              aria-hidden="true"
              className="inline-block size-2 rounded-full bg-current"
            />
            {mockJobAnalysis.seniority}
          </span>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-medium text-fg-muted">
            Competências-chave
          </p>
          <div className="flex flex-wrap gap-2">
            {mockJobAnalysis.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border bg-surface-2 px-3 py-[5px] text-[13px] font-medium text-fg-2"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
