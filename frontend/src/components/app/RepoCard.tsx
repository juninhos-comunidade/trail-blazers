import { cn } from "@lib/cn";
import { GlobeIcon, LockIcon } from "@components/ui/icons";
import type { RepoSummary } from "@lib/repositories-api";

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Ruby: "#701516",
  "C++": "#f34b7d",
  PHP: "#4F5D95",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
};

function languageColor(language: string) {
  return languageColors[language] ?? "var(--color-slate-400)";
}

interface RepositoryCardProps {
  repository: RepoSummary;
  selected?: boolean;
  onSelect?: (repository: RepoSummary) => void;
  className?: string;
}

export function RepositoryCard({
  repository,
  selected = false,
  onSelect,
  className,
}: RepositoryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(repository)}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border bg-surface p-4 text-left transition-all duration-200",
        selected
          ? "border-trail-500 shadow-[0_0_0_1px_var(--color-trail-500)]"
          : "border-border hover:border-trail-500/60 hover:bg-surface-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-[14px]">
          <span className="text-fg-muted">{repository.owner}/</span>
          <span className="font-semibold text-fg">{repository.name}</span>
        </p>

        <span
          className={cn(
            "inline-flex flex-none items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em]",
            repository.visibility === "private"
              ? "border-[--alpha(var(--color-ember-400)/40%)] text-ember-text"
              : "border-border text-fg-2",
          )}
        >
          {repository.visibility === "private" ? (
            <LockIcon size={11} />
          ) : (
            <GlobeIcon size={11} />
          )}
          {repository.visibility === "private" ? "Privado" : "Público"}
        </span>
      </div>

      {repository.language ? (
        <span className="flex items-center gap-1.5 text-[13px] text-fg-2">
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ background: languageColor(repository.language) }}
            aria-hidden="true"
          />
          {repository.language}
        </span>
      ) : (
        <span className="text-[13px] text-fg-muted">Sem linguagem detectada</span>
      )}
    </button>
  );
}
