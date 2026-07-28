import { useState } from "react";

import { cn } from "@lib/cn";
import type { RepoSummary } from "@lib/repositories-api";
import { RepositoryCard } from "@components/app/RepoCard";

const PAGE_SIZE = 15;

interface RepositoryListProps {
  repositories: RepoSummary[];
  selectedId: number | null;
  onSelect: (repository: RepoSummary) => void;
  className?: string;
}

export function RepositoryList({
  repositories,
  selectedId,
  onSelect,
  className,
}: RepositoryListProps) {
  const [visibleCount, setVisibleCount] = useState(
    Math.min(PAGE_SIZE, repositories.length),
  );

  if (repositories.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center",
          className,
        )}
      >
        <p className="text-[15px] text-fg-2">
          Nenhum repositório público encontrado.
        </p>
      </div>
    );
  }

  const visibleRepositories = repositories.slice(0, visibleCount);
  const hasMore = visibleCount < repositories.length;

  return (
    <div
      className={cn(
        "flex max-h-140 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface-2/40 p-3",
        className,
      )}
    >
      {visibleRepositories.map((repository) => (
        <RepositoryCard
          key={repository.id}
          repository={repository}
          selected={repository.id === selectedId}
          onSelect={onSelect}
        />
      ))}

      <div className="flex justify-center py-2">
        {hasMore ? (
          <button
            type="button"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(count + PAGE_SIZE, repositories.length),
              )
            }
            className="font-mono text-[12.5px] font-medium text-trail-text hover:underline"
          >
            Ver mais repositórios
          </button>
        ) : (
          <p className="font-mono text-[12.5px] text-fg-muted">
            Não há mais repositórios.
          </p>
        )}
      </div>
    </div>
  );
}
