export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 21 L11 13 L15 16 L21 6"
        stroke="var(--color-trail-400)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="21" r="2.4" fill="var(--color-trail-400)" />
      <circle cx="11" cy="13" r="2.4" fill="var(--color-trail-400)" />
      <circle cx="15" cy="16" r="2.4" fill="var(--color-ember-400)" />
      <path d="M21 6 L21 2 L25 3.4 L21 5" fill="var(--color-ember-400)" />
      <circle cx="21" cy="6" r="1.4" fill="var(--color-ember-400)" />
    </svg>
  );
}

export function Logo({
  markSize = 26,
  className = "text-xl",
}: {
  markSize?: number;
  className?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={markSize} />
      <span
        className={`font-display font-semibold tracking-[-0.02em] ${className}`}
      >
        Interview<span className="text-trail-text">Trail</span>
      </span>
    </span>
  );
}
