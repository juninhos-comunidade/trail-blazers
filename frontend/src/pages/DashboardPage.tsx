import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/app/AppHeader";
import { EmptyTrail } from "../components/app/EmptyTrail";
import { ButtonLink } from "../components/ui/Button";
import { Container } from "../components/ui/Container";
import { PlusIcon } from "../components/ui/icons";
import { paths } from "../routes/paths";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen animate-rise">
      <AppHeader />

      <main>
        <Container className="max-w-[1080px] pt-10 pb-16">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-semibold tracking-[-0.02em]">
                Olá, {user?.username}
              </h1>
              <p className="mt-2 text-[15px] text-fg-2">
                Continue sua preparação — cada entrevista te deixa mais perto do
                sim.
              </p>
            </div>

            <ButtonLink to={paths.newInterview} className="max-sm:w-full">
              <PlusIcon />
              Nova entrevista
            </ButtonLink>
          </div>

          {/* O histórico de entrevistas depende dos épicos de sessão e
              relatório; até lá todo mundo cai na orientação inicial. */}
          <EmptyTrail />
        </Container>
      </main>
    </div>
  );
}
