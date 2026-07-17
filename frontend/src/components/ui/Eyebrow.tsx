import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Eyebrow({
  children,
  tone = "trail",
  className,
}: {
  children: ReactNode;
  tone?: "trail" | "ember";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-xs font-medium uppercase tracking-[0.14em]",
        tone === "trail" ? "text-trail-text" : "text-ember-text",
        className,
      )}
    >
      {children}
    </span>
  );
}
