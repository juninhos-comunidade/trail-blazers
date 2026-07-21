import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/useTheme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Alternar para o ${label.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface",
        "px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-2",
        "transition-all duration-200 hover:border-trail-500 hover:text-fg",
        className,
      )}
    >
      {label}
    </button>
  );
}
