import { cn } from "../../lib/cn";

export function Spinner({
  size = 44,
  label = "Carregando",
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
      className={cn(
        "animate-spin rounded-full border-[3px] border-border border-t-trail-500",
        className,
      )}
    />
  );
}
