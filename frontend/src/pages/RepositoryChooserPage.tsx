import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@components/app/AppHeader";
import { RepositoryList } from "@components/app/RepoList";
import { Alert } from "@components/ui/Alert";
import { ButtonLink, Button } from "@components/ui/Button";
import { Container } from "@components/ui/Container";
import { Spinner } from "@components/ui/Spinner";
import { fetchRepos, type RepoSummary } from "@lib/repositories-api";
import { paths } from "@routes/paths";

type Status = "loading" | "error" | "success";

export function RepositoryChooserPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<RepoSummary[]>([]);
  const [selected, setSelected] = useState<RepoSummary | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchRepos()
      .then((repos) => {
        if (cancelled) return;
        setRepositories(repos);
        setStatus("success");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setErrorMessage(error.message);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus("loading");
    setErrorMessage(null);
    setAttempt((count) => count + 1);
  }, []);

  const canProceed =
    status === "success" && (repositories.length === 0 || selected !== null);

  return (
    <div className="min-h-screen animate-rise">
      <AppHeader />

      <main>
        <Container className="max-w-270 pt-10 pb-16">
          <div className="mb-6">
            <h1 className="font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-semibold tracking-[-0.02em]">
              Escolha um repositório
            </h1>
            <p className="mt-2 text-[15px] text-fg-2">
              Selecione o projeto que você quer que o InterviewTrail analise
              nesta entrevista.
            </p>
          </div>

          {status === "loading" && (
            <div className="flex justify-center py-16">
              <Spinner label="Carregando seus repositórios" />
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
              <Alert tone="danger">{errorMessage}</Alert>
              <Button variant="secondary" onClick={retry}>
                Tentar novamente
              </Button>
            </div>
          )}

          {status === "success" && (
            <RepositoryList
              repositories={repositories}
              selectedId={selected?.id ?? null}
              onSelect={(repository) =>
                setSelected((current) =>
                  current?.id === repository.id ? null : repository,
                )
              }
            />
          )}

          <div className="mt-7 flex justify-end">
            <ButtonLink to={paths.inProgress} size="lg" disabled={!canProceed}>
              Próximo
            </ButtonLink>
          </div>
        </Container>
      </main>
    </div>
  );
}
