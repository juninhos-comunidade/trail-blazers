import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@components/app/AppHeader";
import { InterviewStepper } from "@components/app/InterviewStepper";
import { RepositoryList } from "@components/app/RepoList";
import { Alert } from "@components/ui/Alert";
import { ButtonLink, Button } from "@components/ui/Button";
import { Spinner } from "@components/ui/Spinner";
import { fetchRepos, type RepoSummary } from "@lib/repositories-api";
import { paths } from "@routes/paths";

type Status = "loading" | "error" | "success";

/**
 * Teto de repositórios por entrevista. Hoje vale 1 por simplicidade; a tela já
 * é multisseleção, então ampliar é só mexer nesta constante.
 */
const SELECTION_LIMIT = 1;

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="flex-none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 7.5v3.5M8 5.2v.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RepositoryChooserPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<RepoSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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

  const toggle = useCallback((repository: RepoSummary) => {
    setSelectedIds((current) => {
      if (current.includes(repository.id)) {
        return current.filter((id) => id !== repository.id);
      }
      return current.length < SELECTION_LIMIT
        ? [...current, repository.id]
        : current;
    });
  }, []);

  const canStart = status === "success" && selectedIds.length > 0;

  return (
    <div className="min-h-screen animate-rise">
      <AppHeader label="Nova entrevista" />

      <main className="mx-auto w-full max-w-[860px] px-6 pt-10 pb-18">
        <InterviewStepper current={2} className="mb-12" />

        <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <h1 className="mb-2 font-display text-[clamp(1.5rem,3vw,1.9rem)] font-semibold tracking-[-0.02em]">
              Quais projetos entram na análise?
            </h1>
            <p className="flex items-center gap-2 text-[15px] text-fg-2">
              <InfoIcon />
              Selecione até {SELECTION_LIMIT}{" "}
              {SELECTION_LIMIT === 1 ? "repositório" : "repositórios"} para uma
              análise mais focada.
            </p>
          </div>

          {status === "success" && repositories.length > 0 && (
            <span
              aria-live="polite"
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 font-mono text-xs text-fg-2"
            >
              {selectedIds.length}/{SELECTION_LIMIT}{" "}
              {SELECTION_LIMIT === 1 ? "selecionado" : "selecionados"}
            </span>
          )}
        </div>

        {status === "loading" && (
          <div className="flex justify-center py-16">
            <Spinner label="Carregando seus repositórios" />
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
            <Alert tone="danger">{errorMessage}</Alert>
            <Button variant="secondary" onClick={retry}>
              Tentar novamente
            </Button>
          </div>
        )}

        {status === "success" && (
          <RepositoryList
            repositories={repositories}
            selectedIds={selectedIds}
            limit={SELECTION_LIMIT}
            onToggle={toggle}
          />
        )}

        <div className="mt-9 flex flex-wrap justify-between gap-3">
          <ButtonLink to={paths.dashboard} variant="ghost">
            ← Voltar
          </ButtonLink>

          <ButtonLink
            to={paths.inProgress}
            variant="ember"
            disabled={!canStart}
            className="max-sm:w-full"
          >
            Iniciar entrevista →
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
