import { useEffect, useState } from 'react'
import { readHealth, onHealthChange, type CaptureHealth } from '@/lib/health'
import { readPrefs, onPrefsChange, isPaused, type Prefs } from '@/lib/prefs'
import { PLATFORM_LABEL, type Platform } from '@/lib/types'

const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[]

function isSaving(health: CaptureHealth, prefs: Prefs | null): boolean {
  if (prefs && isPaused(prefs)) return false
  return !PLATFORMS.some((p) => health[p]?.ok === false)
}

function detail(health: CaptureHealth, prefs: Prefs | null): string {
  if (prefs && isPaused(prefs)) return 'Saving is paused — resume from the toolbar popup'
  const broken = PLATFORMS.filter((p) => health[p]?.ok === false)
  if (broken.length)
    return `Deja may not be saving on ${broken.map((p) => PLATFORM_LABEL[p]).join(', ')}`
  return 'Deja is quietly saving your prompts'
}

/**
 * One-line capture health for the library — a glowing light + Saving On /
 * Not Saving. Detail lives in Settings.
 */
export function CaptureHealthBadge({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [health, setHealth] = useState<CaptureHealth>({})
  const [prefs, setPrefs] = useState<Prefs | null>(null)

  useEffect(() => {
    void readHealth().then(setHealth)
    void readPrefs().then(setPrefs)
    const offHealth = onHealthChange(setHealth)
    const offPrefs = onPrefsChange(setPrefs)
    return () => {
      offHealth()
      offPrefs()
    }
  }, [])

  const saving = isSaving(health, prefs)
  const title = detail(health, prefs)
  const className =
    'inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition-[background-color,border-color,color,transform] duration-150 hover:bg-sunk focus:outline-none focus:ring-2 focus:ring-accent active:scale-[0.98]'

  const body = (
    <>
      <span
        className={`h-2 w-2 rounded-full ${saving ? 'dj-glow-ok' : 'dj-glow-danger'}`}
        aria-hidden
      />
      <span className={saving ? 'text-ink' : 'text-danger'}>
        {saving ? 'Saving On' : 'Not Saving'}
      </span>
    </>
  )

  if (onOpenSettings) {
    return (
      <button type="button" onClick={onOpenSettings} title={title} aria-label={title} className={className}>
        {body}
      </button>
    )
  }

  return (
    <span title={title} aria-label={title} className={className}>
      {body}
    </span>
  )
}
