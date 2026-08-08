interface Props {
  filled?: boolean
  size?: number
  className?: string
}

/**
 * Monochrome heart — favorites mark. Uses currentColor so callers pick color
 * via text classes. `filled` toggles solid vs outline.
 */
export function FavoriteIcon({ filled = false, size = 14, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 13.25S2.75 9.8 2.75 6.4A2.9 2.9 0 0 1 8 4.85 2.9 2.9 0 0 1 13.25 6.4C13.25 9.8 8 13.25 8 13.25Z" />
    </svg>
  )
}

/** Overlapping-pages copy glyph. */
export function CopyIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  )
}

/** Trash-can delete glyph. */
export function TrashIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 4.5h9M6.5 4.5V3.25A.75.75 0 0 1 7.25 2.5h1.5a.75.75 0 0 1 .75.75V4.5M5 4.5l.5 8.25A1 1 0 0 0 6.5 13.5h3a1 1 0 0 0 1-.75L11 4.5" />
    </svg>
  )
}

/** Brief check used after a successful copy. */
export function CheckIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  )
}

export function SearchIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}

export function ClockIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="5.25" />
      <path d="M8 5.5V8l2 1.5" />
    </svg>
  )
}

/** Circular arrows — reused count. */
export function ReuseIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.5 7.25A4.5 4.5 0 0 1 12 5.5l.75 1.25" />
      <path d="M12.5 4.5v2.5H10" />
      <path d="M12.5 8.75A4.5 4.5 0 0 1 4 10.5L3.25 9.25" />
      <path d="M3.5 11.5V9H6" />
    </svg>
  )
}

export function ChevronIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.5 6.5 8 10l3.5-3.5" />
    </svg>
  )
}

/** Tiny lock — local-only reassurance. */
export function LockIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

export function CloseIcon({ size = 14, className = '' }: Omit<Props, 'filled'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </svg>
  )
}
