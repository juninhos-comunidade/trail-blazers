import { Outlet, useLocation, useParams } from "react-router-dom";

import { AppHeader } from "@components/app/AppHeader";
import { InterviewStepper } from "@components/app/InterviewStepper";
import { Container } from "@components/ui/Container";
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
 * Um passo só é clicável quando já existe `sessionId` na URL — antes disso
 * (vaga/repositório ainda sendo criados) não há sessão para revisar. Não
 * checamos se a sessão já tem relatório: se o candidato tentar ver o
 * relatório antes da hora, a própria página de relatório redireciona de
 * volta para a conversa.
 */
export function InterviewFlowLayout() {
  const { pathname } = useLocation();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const current = stepFromPathname(pathname);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />

      <div className="flex-none pt-8 sm:pt-10">
        <Container>
          <InterviewStepper
            current={current}
            className="mb-12"
            getStepHref={(step) => buildStepHref(step, { sessionId, canViewReport: true })}
          />
        </Container>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
