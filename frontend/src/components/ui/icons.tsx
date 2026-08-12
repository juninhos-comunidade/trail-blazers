import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function GitHubIcon({
  size = 16,
  ...props
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function PlusIcon({
  size = 15,
  ...props
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockIcon({
  size = 14,
  ...props
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3"
        y="7"
        width="10"
        height="6.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5.5 7 V5.2 a2.5 2.5 0 0 1 5 0 V7"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function CheckIcon({
  size = 11,
  ...props
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon({ size = 12, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 8h12M8 1.8c1.8 1.7 2.8 3.9 2.8 6.2S9.8 12.5 8 14.2C6.2 12.5 5.2 10.3 5.2 8S6.2 3.5 8 1.8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 14, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6 7.2v4.3M10 7.2v4.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M4 4.5 4.6 13a1.5 1.5 0 0 0 1.5 1.4h3.8a1.5 1.5 0 0 0 1.5-1.4l.6-8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MicIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3 7.5v.5a5 5 0 0 0 10 0v-.5M8 13v1.5M5.7 14.5h4.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpeakerIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2 6.2h2.4L8 3v10L4.4 9.8H2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.8 5.3a3.6 3.6 0 0 1 0 5.4M12.8 3.4a6.6 6.6 0 0 1 0 9.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpeakerMuteIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2 6.2h2.4L8 3v10L4.4 9.8H2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M11 6l3.5 4M14.5 6 11 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ReplayIcon({ size = 15, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13.5 8A5.5 5.5 0 1 1 11.7 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11.7 1.3v3.2H8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CommitIcon({ size = 13, ...props }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <line x1="1" y1="8" x2="5" y2="8" stroke="currentColor" strokeWidth="1.4" />
      <line x1="11" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
