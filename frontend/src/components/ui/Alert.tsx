import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

type AlertTone = "warning" | "danger";

const tones: Record<AlertTone, string> = {
  warning:
    "border-[--alpha(var(--color-warning)/35%)] bg-[--alpha(var(--color-warning)/12%)]",
  danger:
    "border-[--alpha(var(--color-danger)/35%)] bg-[--alpha(var(--color-danger)/12%)]",
};

export function Alert({
  children,
  tone = "warning",
  className,
}: {
  children: ReactNode;
  tone?: AlertTone;
  className?: string;
}) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border px-3.5 py-3 text-left text-[13.5px] leading-[1.55] text-fg",
        tones[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}
