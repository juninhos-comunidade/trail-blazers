import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-md font-semibold " +
  "transition-all duration-200 no-underline hover:no-underline";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-trail-500 text-on-trail hover:bg-trail-400 hover:-translate-y-px " +
    "hover:shadow-[0_6px_18px_--alpha(var(--color-trail-500)/35%)]",
  secondary:
    "bg-transparent text-fg border border-border hover:border-trail-500 hover:text-trail-text",
  ghost: "bg-transparent text-fg-2 hover:text-fg hover:bg-surface-2",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-sm px-3.5 py-2.5",
  md: "text-[15px] px-5 py-3",
  lg: "text-[15.5px] px-6 py-3.5",
};

export function buttonStyles(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
) {
  return cn(
    base,
    variants[variant],
    sizes[size],
    "disabled:opacity-45 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none",
    className,
  );
}
