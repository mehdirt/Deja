interface Props {
  size?: number
  withWordmark?: boolean
  className?: string
}

/**
 * Deja mark — a card and its echo: the "I've seen this before" double image of
 * déjà vu, which is the product's defining moment. The ghosted card behind hints
 * at the prior prompt resurfacing under the one you're typing. White on the
 * accent tile; a terminal-cursor tick keeps the "notebook meets terminal" feel.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ps-accent)" />
      {/* echo: the ghosted prior card behind */}
      <rect x="7" y="7" width="13" height="13" rx="3.5" fill="white" opacity="0.4" />
      {/* the card you're on now */}
      <rect x="12" y="12" width="13" height="13" rx="3.5" fill="white" opacity="0.95" />
      {/* terminal cursor tick on the front card */}
      <rect x="15" y="17" width="2.4" height="3.6" rx="0.6" fill="var(--ps-accent)" />
    </svg>
  )
}

export function Logo({ size = 24, withWordmark = true, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-mono font-semibold tracking-tight text-ink">
          de<span className="text-accent">ja</span>
        </span>
      )}
    </span>
  )
}
