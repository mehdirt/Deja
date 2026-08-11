import { useEffect, useMemo, useRef, useState } from 'react'

// The resurface moment, shown rather than described — framed like the landing
// page tooltip mock (surface card, accent lead, soft pop shadow).

const TYPED = 'plan a few days in lisbon, somewhere quiet'
const REMEMBERED =
  'Plan a 3-day trip to Lisbon for someone who hates crowds. Include one rainy-day option.'

const DEMO_LEAD = "You've asked something like this before →"

const TYPE_MS = 45
const PAUSE_BEFORE_TIP_MS = 420
const TIP_VISIBLE_MS = 2000
const HOLD_MS = 1800

type Phase = 'typing' | 'suggesting' | 'replaced' | 'still'

const CAPTIONS: Record<Phase, string> = {
  typing: 'You start typing, the way you always do.',
  suggesting: 'Your earlier version appears above the box.',
  replaced: 'One click, and the one you saved is in the box.',
  still: 'Your earlier version, back in the box.',
}

export function WelcomeDemo({
  autoPlay,
  onFirstPlayComplete,
}: {
  autoPlay: boolean
  onFirstPlayComplete?: () => void
}) {
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  )
  const shouldAuto = autoPlay && !reduced

  const [phase, setPhase] = useState<Phase>(shouldAuto ? 'typing' : 'still')
  const [typed, setTyped] = useState(shouldAuto ? '' : REMEMBERED)
  const [runId, setRunId] = useState(0)
  const timers = useRef<number[]>([])
  const completedRef = useRef(false)

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
    clear()
    if (!shouldAuto && runId === 0) return

    const later = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms))
    }

    setPhase('typing')
    setTyped('')

    let i = 0
    const finish = () => {
      setPhase('still')
      if (!completedRef.current) {
        completedRef.current = true
        onFirstPlayComplete?.()
      }
    }

    const step = () => {
      i += 1
      setTyped(TYPED.slice(0, i))
      if (i < TYPED.length) {
        later(step, TYPE_MS)
        return
      }
      later(() => setPhase('suggesting'), PAUSE_BEFORE_TIP_MS)
      later(() => {
        setPhase('replaced')
        setTyped(REMEMBERED)
      }, PAUSE_BEFORE_TIP_MS + TIP_VISIBLE_MS)
      later(finish, PAUSE_BEFORE_TIP_MS + TIP_VISIBLE_MS + HOLD_MS)
    }
    later(step, TYPE_MS)

    return clear
  }, [runId, shouldAuto, onFirstPlayComplete])

  const showTip = phase === 'suggesting'

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-bg p-4 shadow-card">
      <div className="min-h-[42px]">
        <div
          className={`flex w-fit max-w-full items-start gap-2.5 rounded-[12px] border border-line bg-surface px-3 py-2.5 shadow-pop transition-all duration-200 ${
            showTip ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          }`}
          aria-hidden={!showTip}
        >
          <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold leading-snug tracking-tight text-accent">
              {DEMO_LEAD}
            </span>
            <span className="truncate text-[12.5px] text-ink-soft">{REMEMBERED}</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-[56px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3 shadow-card">
        <span className="dj-chip flex-none text-[11px]">ChatGPT</span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
          {typed}
          {phase === 'typing' && (
            <span
              aria-hidden
              className="ml-px inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-accent"
            />
          )}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="dj-meta" aria-live="polite">
          {reduced && phase === 'still'
            ? 'Motion is turned down on this device — press play to watch it once.'
            : CAPTIONS[phase]}
        </p>
        <button
          onClick={() => setRunId((r) => r + 1)}
          className="dj-btn px-2.5 py-1 text-xs"
        >
          {phase === 'still' ? 'Play the demo' : 'Replay'}
        </button>
      </div>
    </div>
  )
}
