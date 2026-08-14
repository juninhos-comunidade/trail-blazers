import type { ReactNode } from "react";

import { cn } from "@lib/cn";

interface FallbackPanelProps {
  title: string;
  detail: string;
  hint?: string;
  tone?: "neutral" | "danger";
  action?: ReactNode;
}

export function FallbackPanel({
  title,
  detail,
  hint,
  tone = "neutral",
  action,
}: FallbackPanelProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-5 py-12 text-center sm:px-6 sm:py-14",
        tone === "danger"
          ? "border-[--alpha(var(--color-danger)/45%)] bg-[--alpha(var(--color-danger)/8%)]"
          : "border-border bg-surface",
      )}
    >
      <h2
        className={cn(
          "font-display text-[1.15rem] font-semibold",
          tone === "danger" && "text-danger",
        )}
      >
        {title}
      </h2>

      <p className="max-w-[46ch] text-[14.5px] leading-[1.55] text-fg-2">
        {detail}
      </p>

      {hint && (
        <p className="max-w-[46ch] font-mono text-[11.5px] text-fg-muted">
          {hint}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
