import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { paths } from "@routes/paths";

import { removeCursor } from "./demo-dom";
import { DEMO_LOOP } from "./demo-flag";
import { claimDemoRun, demoSteps, runDemoScript, type DemoStepId } from "./demo-script";

type Phase = "running" | "done" | "aborted";

export function DemoAutopilot() {
  const navigate = useNavigate();
  const [step, setStep] = useState<DemoStepId>("landing");
  const [phase, setPhase] = useState<Phase>("running");
  const [reason, setReason] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!claimDemoRun()) return;

    startedAt.current = Date.now();

    void runDemoScript({
      navigate: (to) => navigate(to, { replace: true }),
      onStep: setStep,
      onFinish: () => setPhase("done"),
      onAbort: (message) => {
        setReason(message);
        setPhase("aborted");
      },
    });
  }, [navigate]);

  useEffect(() => {
    if (phase !== "running") return;

    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAt.current),
      100,
    );

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "done" || !DEMO_LOOP) return;

    const timer = window.setTimeout(() => {
      removeCursor();
      window.location.assign(paths.landing);
    }, 2_000);

    return () => window.clearTimeout(timer);
  }, [phase]);

  const currentIndex = demoSteps.findIndex((item) => item.id === step);
  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 left-4 z-[2147482000] w-[260px] rounded-xl border border-border bg-surface/95 p-3.5 font-mono text-[11px] text-fg-2 shadow-lg backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold tracking-[0.08em] text-trail-text uppercase">
          <span className="inline-block size-[7px] animate-pulse rounded-full bg-trail-500" />
          Demo automática
        </span>
        <span className="text-fg-muted">{seconds}s</span>
      </div>

      <div className="mb-2 flex gap-1">
        {demoSteps.map((item, index) => (
          <span
            key={item.id}
            className={`h-1 flex-1 rounded-full ${
              index <= currentIndex ? "bg-trail-500" : "bg-surface-2"
            }`}
          />
        ))}
      </div>

      {phase === "running" && (
        <p className="text-fg">
          {currentIndex + 1}/{demoSteps.length} · {demoSteps[currentIndex]?.label}
        </p>
      )}

      {phase === "done" && (
        <p className="text-trail-text">
          Fluxo completo em {seconds}s{DEMO_LOOP ? " · reiniciando…" : ""}
        </p>
      )}

      {phase === "aborted" && (
        <p className="text-danger">Demo interrompida: {reason}</p>
      )}

      <p className="mt-1.5 text-[10px] text-fg-muted">
        dados fictícios · ?demo=off desliga
      </p>
    </div>
  );
}
