interface Props {
  size?: number
  withWordmark?: boolean
  className?: string
}

/**
 * PromptShelf mark — a shelf holding "books" (saved prompts) with a
 * terminal cursor. Uses currentColor for the books so it inherits ink,
 * and the accent token for the shelf + cursor.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ps-accent)" />
      {/* books on the shelf */}
      <rect x="9" y="9" width="3.2" height="11" rx="1" fill="white" opacity="0.95" />
      <rect x="13" y="11" width="3.2" height="9" rx="1" fill="white" opacity="0.8" />
      <rect x="17" y="8" width="3.2" height="12" rx="1" fill="white" opacity="0.95" />
      {/* terminal cursor */}
      <rect x="21.2" y="16" width="2.6" height="4" rx="0.6" fill="white" opacity="0.65" />
      {/* shelf */}
      <rect x="7.5" y="21.5" width="17" height="2.2" rx="1.1" fill="white" />
    </svg>
  )
}

export function Logo({ size = 24, withWordmark = true, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-mono font-semibold tracking-tight text-ink">
          prompt<span className="text-accent">shelf</span>
        </span>
      )}
    </span>
  )
}
