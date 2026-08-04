export function ErrorRetry({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div className={compact ? 'px-2 py-8 text-center text-sm text-ink-soft' : 'py-16 text-center text-sm'}>
      <p className="text-ink">Couldn&apos;t load your prompts just now.</p>
      <button
        onClick={onRetry}
        className={`dj-btn dj-btn-ghost text-xs ${compact ? 'mt-2 px-2 py-1' : 'mt-3 px-3 py-1.5'}`}
      >
        Try again
      </button>
    </div>
  )
}
