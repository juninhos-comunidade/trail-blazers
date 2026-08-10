import { Link } from "react-router-dom";

import type { InterviewSessionSummary, SessionStatus } from "@lib/interview-api";
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

export function SessionCard({ session }: { session: InterviewSessionSummary }) {
  const score = session.report ? Math.round(session.report.overallScore) : null;
  const title = buildTitle(session);

  return (
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
  );
}
