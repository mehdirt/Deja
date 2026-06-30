import { useEffect, useState } from 'react'
import { readHealth, onHealthChange, type CaptureHealth } from '@/lib/health'
import { PLATFORM_LABEL, type Platform } from '@/lib/types'

const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[]

type State = 'ok' | 'broken' | 'unknown'

function stateFor(health: CaptureHealth, p: Platform): State {
  const h = health[p]
  if (!h) return 'unknown'
  return h.ok ? 'ok' : 'broken'
}

function dotClass(state: State): string {
  if (state === 'ok') return 'bg-ok'
  if (state === 'broken') return 'bg-danger'
  return 'bg-ink-faint/40'
}

function titleFor(state: State, p: Platform): string {
  const label = PLATFORM_LABEL[p]
  if (state === 'ok') return `Capture is working on ${label}`
  if (state === 'broken')
    return `Couldn't find the prompt box on ${label} — the site may have changed. Capture there may be paused.`
  return `Not checked yet — open ${label} and Deja starts listening`
}

// A quiet at-a-glance proof that deja is actually listening. Stays
// unobtrusive when all is well; speaks up only when a platform looks broken,
// so a silently-broken selector can never masquerade as working capture.
export function CaptureStatus() {
  const [health, setHealth] = useState<CaptureHealth>({})

  useEffect(() => {
    void readHealth().then(setHealth)
    return onHealthChange(setHealth)
  }, [])

  const broken = PLATFORMS.filter((p) => stateFor(health, p) === 'broken')

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-faint">
      <span className="text-ink-soft">capture</span>
      {PLATFORMS.map((p) => {
        const state = stateFor(health, p)
        return (
          <span key={p} className="inline-flex items-center gap-1.5" title={titleFor(state, p)}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass(state)}`} aria-hidden />
            <span className={state === 'broken' ? 'text-danger' : undefined}>
              {PLATFORM_LABEL[p]}
            </span>
          </span>
        )
      })}
      {broken.length > 0 && (
        <span className="text-danger">
          · capture looks broken on {broken.map((p) => PLATFORM_LABEL[p]).join(', ')}
        </span>
      )}
    </div>
  )
}
