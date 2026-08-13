import { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";

import { AppHeader } from "@components/app/AppHeader";
import { InterviewStepper } from "@components/app/InterviewStepper";
import { Container } from "@components/ui/Container";
import { getSession, type SessionStatus } from "@lib/interview-api";
import { readSessionDraft, readVacancyDraft } from "@lib/interview-draft";
import { buildStepHref, paths } from "@routes/paths";

function stepFromPathname(pathname: string): number {
  if (pathname.startsWith(paths.report)) return 4;
  if (pathname.startsWith(paths.interview)) return 3;
  if (pathname.startsWith(paths.repoChooser)) return 2;
  return 1;
}

/**
 * Envolve as telas do fluxo de entrevista (vaga → repositórios → conversa →
 * relatório) numa única instância da navbar e do stepper. Como é uma
 * rota-layout, o React Router mantém este componente montado entre as
 * etapas — só o conteúdo do `Outlet` troca, então navbar e stepper nunca
 * reiniciam/"recarregam" ao navegar, e ficam idênticos em todas as telas.
 *
 * O progresso "concluído" do stepper vem do status real da sessão no
 * backend, não da página que está sendo vista — assim, revisar uma etapa
 * anterior não faz as etapas seguintes perderem a marcação de concluídas.
 * Também é o que trava a navegação para uma etapa futura: só existe link
 * para o relatório quando a entrevista já foi totalmente respondida.
 */
export function InterviewFlowLayout() {
  const { pathname } = useLocation();
  const { sessionId: paramSessionId } = useParams<{ sessionId?: string }>();
  const current = stepFromPathname(pathname);

  const sessionId = paramSessionId ?? readSessionDraft()?.id;
  const [status, setStatus] = useState<SessionStatus | null>(null);

  useEffect(() => {
    const id = paramSessionId ?? readSessionDraft()?.id;
    if (!id) return;

    let cancelled = false;

    getSession(id)
      .then((session) => {
        if (!cancelled) setStatus(session.status);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, paramSessionId]);

  const hasSession = Boolean(sessionId);
  const hasVacancy = Boolean(readVacancyDraft());
  const interviewDone = status !== null && status !== "in_progress" && status !== "preparing";
  const reportDone = status === "completed";
  /**
   * `hasSession` decide antes das etapas seguintes: se a sessão mudou (ou
   * deixou de existir) e o fetch acima ainda não voltou, um `status` de uma
   * sessão anterior não pode "vazar" e marcar passos como concluídos
   * indevidamente. A etapa 1, porém, não depende de sessão nenhuma — ela é
   * concluída assim que o usuário salva a vaga e clica em "Continuar",
   * antes de qualquer sessão existir.
   */
  const maxCompletedStep = reportDone
    ? 4
    : interviewDone
      ? 3
      : hasSession
        ? 2
        : hasVacancy
          ? 1
          : 0;

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />

      <div className="flex-none pt-8 sm:pt-10">
        <Container>
          <InterviewStepper
            current={current}
            maxCompletedStep={maxCompletedStep}
            className="mb-12"
            getStepHref={(step) =>
              buildStepHref(step, { sessionId, canViewReport: interviewDone })
            }
          />
        </Container>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
