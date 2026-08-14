export const paths = {
  landing: "/",
  inProgress: "/em-desenvolvimento",

  login: "/login",
  authCallback: "/auth/success",
  dashboard: "/dashboard",

  newInterview: "/entrevista/vaga",
  repoChooser: "/entrevista/repositorios",
  interview: "/entrevista/conversa",
  report: "/entrevista/relatorio",
} as const;

export function reportPath(sessionId?: string): string {
  return sessionId ? `${paths.report}/${sessionId}` : paths.report;
}

export function interviewPath(sessionId?: string): string {
  return sessionId ? `${paths.interview}/${sessionId}` : paths.interview;
}

export function vacancyReviewPath(sessionId: string): string {
  return `${paths.newInterview}/${sessionId}`;
}

export function repoReviewPath(sessionId: string): string {
  return `${paths.repoChooser}/${sessionId}`;
}

export function buildStepHref(
  step: number,
  ctx: { sessionId?: string; canViewReport?: boolean },
): string | undefined {
  if (!ctx.sessionId) return undefined;

  switch (step) {
    case 1:
      return vacancyReviewPath(ctx.sessionId);
    case 2:
      return repoReviewPath(ctx.sessionId);
    case 3:
      return interviewPath(ctx.sessionId);
    case 4:
      return ctx.canViewReport ? reportPath(ctx.sessionId) : undefined;
    default:
      return undefined;
  }
}

export const sectionIds = {
  howItWorks: "como-funciona",
} as const;
