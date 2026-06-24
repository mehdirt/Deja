interface Props {
  filled?: boolean
  size?: number
  className?: string
}

/**
 * Monochrome pin glyph — replaces the full-color 📌 emoji so the UI stays
 * "two colors, no web fonts/emoji" and renders identically across OSes.
 * Uses currentColor so the caller picks the color via text classes
 * (accent when pinned, ink-faint when not). `filled` toggles solid vs outline.
 */
export function PinIcon({ filled = false, size = 12, className = '' }: Props) {
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
      <path d="M9.5 1.5 14.5 6.5l-2.7.7-2.6 2.6-.7 3.2-1.4-1.4-3.3 3.3-.6.1.1-.6 3.3-3.3-1.4-1.4 3.2-.7 2.6-2.6.7-2.7Z" />
    </svg>
  )
}
