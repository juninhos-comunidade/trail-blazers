import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@components/ui/Button";
import { TrashIcon } from "@components/ui/icons";
import { clearVacancyDraft, readSessionDraft } from "@lib/interview-draft";
import {
  deleteSession,
  InterviewError,
  type InterviewSessionSummary,
  type SessionStatus,
} from "@lib/interview-api";
import { seniorityLabels } from "@lib/vacancies-api";
import { interviewPath, reportPath } from "@routes/paths";

const MAX_TITLE_LENGTH = 80;

function scoreColor(score: number) {
  if (score >= 75) return "var(--color-trail-text)";
  if (score >= 60) return "var(--color-ember-text)";
  return "var(--color-danger)";
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1).trimEnd()}…`
    : text;
}

function buildTitle(session: InterviewSessionSummary): string {
  const seniority = seniorityLabels[session.vacancy.seniorityLevel as keyof typeof seniorityLabels] ?? "";
  const stack = session.vacancy.technologies.slice(0, 2).join(", ");
  const role = [seniority, stack].filter(Boolean).join(" — ") || "Entrevista";

  return session.repo ? `${role} — ${session.repo.fullName}` : role;
}

function buildSubtitle(session: InterviewSessionSummary): string {
  const date = new Date(session.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${date} · ${session.questionCount} perguntas`;
}

function linkFor(session: InterviewSessionSummary): string {
  return session.status === "in_progress" ? interviewPath(session.id) : reportPath(session.id);
}

function StatusFooter({ session }: { session: InterviewSessionSummary }) {
  if (session.report) {
    const adherence = Math.round(session.report.adherenceScore);

    return (
      <div className="flex items-center justify-between gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[--alpha(var(--color-trail-500)/30%)] bg-[--alpha(var(--color-trail-500)/13%)] px-3 py-1 text-[12.5px] font-semibold text-trail-text">
          Aderência <span className="font-mono">{adherence}%</span>
        </span>
        <span className="font-mono text-[11.5px] text-fg-muted">ver relatório →</span>
      </div>
    );
  }

  const label: Record<Extract<SessionStatus, "in_progress" | "evaluating">, string> = {
    in_progress: "Em andamento",
    evaluating: "Aguardando avaliação",
  };

  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[--alpha(var(--color-ember-400)/40%)] bg-[--alpha(var(--color-ember-400)/13%)] px-3 py-1 text-[12.5px] font-semibold text-ember-text">
        {label[session.status as "in_progress" | "evaluating"] ?? "Em andamento"}
      </span>
      <span className="font-mono text-[11.5px] text-fg-muted">
        {session.status === "in_progress" ? "continuar →" : "ver relatório →"}
      </span>
    </div>
  );
}

export function SessionCard({
  session,
  onDeleted,
}: {
  session: InterviewSessionSummary;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<InterviewError | null>(null);

  const score = session.report ? Math.round(session.report.overallScore) : null;
  const title = buildTitle(session);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      await deleteSession(session.id);

      // O rascunho em sessionStorage (vaga/repositório/sessão) sobrevive à
      // navegação para permitir retomar uma entrevista — mas se ele aponta
      // para a sessão que acabou de ser apagada, uma "Nova entrevista"
      // subsequente ainda mostraria os dados em cache até tentar buscar do
      // backend e receber 404. Limpa o rascunho quando ele é dessa sessão.
      if (readSessionDraft()?.id === session.id) clearVacancyDraft();

      onDeleted(session.id);
    } catch (cause) {
      setError(
        cause instanceof InterviewError
          ? cause
          : new InterviewError("Não conseguimos apagar esta entrevista."),
      );
      setDeleting(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex h-[172px] flex-col justify-between gap-2.5 overflow-hidden rounded-lg border border-[--alpha(var(--color-danger)/45%)] bg-[--alpha(var(--color-danger)/8%)] p-4.5">
        <div className="min-w-0">
          <p className="text-[14px] leading-[1.3] font-semibold text-fg">
            Apagar esta entrevista?
          </p>
          {/* Nunca as duas ao mesmo tempo: com erro, ele substitui a descrição — o
              bloco fica limitado a 2 linhas para o card não crescer de tamanho. */}
          <p
            className={
              "mt-1.5 line-clamp-2 text-[12.5px] leading-[1.4] " +
              (error ? "text-danger" : "text-fg-2")
            }
          >
            {error
              ? error.detail
              : "Perguntas, respostas e o relatório serão apagados. Não pode ser desfeito."}
          </p>
        </div>

        <div className="flex flex-none gap-2.5">
          <Button
            variant="danger"
            size="sm"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? "Apagando…" : "Apagar"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <Link
        to={linkFor(session)}
        className="flex h-[172px] flex-col justify-between gap-4 rounded-lg border border-border bg-surface p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-trail-600 hover:no-underline"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              title={title}
              className="line-clamp-2 font-display text-[16.5px] leading-[1.3] font-semibold text-fg"
            >
              {truncate(title, MAX_TITLE_LENGTH)}
            </h3>
            <p className="mt-1.5 truncate font-mono text-xs text-fg-muted">
              {buildSubtitle(session)}
            </p>
          </div>

          {score !== null && (
            <p
              className="flex-none font-display text-[26px] leading-none font-bold"
              style={{ color: scoreColor(score) }}
            >
              {score}
              <span className="text-[13px] font-normal text-fg-muted">/100</span>
            </p>
          )}
        </div>

        <StatusFooter session={session} />
      </Link>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setConfirming(true);
        }}
        aria-label="Apagar entrevista"
        className="absolute -top-2.5 -right-2.5 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-fg-muted opacity-0 shadow-sm transition-opacity duration-200 hover:border-danger hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}
