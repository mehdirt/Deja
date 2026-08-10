import { useEffect, useMemo, useRef, useState } from 'react'

// The resurface moment, shown rather than described.
//
// The welcome screen used to explain this in a paragraph, and a paragraph is
// the wrong tool: nobody can picture "your earlier version appears above the
// box" until they have seen it happen once. Deja is a passive tool, so the
// failure mode was never a confusing setup screen — it was nothing visible
// happening and the extension being forgotten.
//
// Built from one timeout chain and CSS, not a library. Under reduced motion it
// renders the final frame with a play button instead, and it does the same on
// any later visit, because someone returning through "show me how this works
// again" does not need it moving at them a second time.

const TYPED = 'plan a few days in lisbon, somewhere quiet'
const REMEMBERED =
  'Plan a 3-day trip to Lisbon for someone who hates crowds. Include one rainy-day option.'

const TYPE_MS = 45
const PAUSE_BEFORE_TIP_MS = 420
const TIP_VISIBLE_MS = 2000
const HOLD_MS = 2600

type Phase = 'typing' | 'suggesting' | 'replaced' | 'still'

const CAPTIONS: Record<Phase, string> = {
  typing: 'You start typing, the way you always do.',
  suggesting: 'Deja recognises it, and offers what you saved before.',
  replaced: 'One click, and your own better wording is in the box.',
  still: 'Your earlier version, back in the box.',
}

export function WelcomeDemo({ autoPlay }: { autoPlay: boolean }) {
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  )
  const shouldPlay = autoPlay && !reduced

  const [phase, setPhase] = useState<Phase>(shouldPlay ? 'typing' : 'still')
  const [typed, setTyped] = useState(shouldPlay ? '' : REMEMBERED)
  const [runId, setRunId] = useState(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
    clear()
    if (!shouldPlay && runId === 0) return

    const later = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms))
    }

    setPhase('typing')
    setTyped('')

    let i = 0
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
      // Only the autoplaying first view loops; a manual replay plays once and
      // leaves the finished frame on screen.
      if (shouldPlay) {
        later(() => setRunId((r) => r + 1), PAUSE_BEFORE_TIP_MS + TIP_VISIBLE_MS + HOLD_MS)
      }
    }
    later(step, TYPE_MS)

    return clear
  }, [runId, shouldPlay])

  const showTip = phase === 'suggesting'

  return (
    <div className="dj-card flex flex-col gap-3 bg-bg p-4">
      {/* Reserve the tooltip's height so the frame never jumps as it appears. */}
      <div className="min-h-[34px]">
        <div
          className={`flex w-fit max-w-full items-center gap-2 rounded-btn border border-line bg-surface px-2.5 py-1.5 shadow-pop transition-all duration-200 ${
            showTip ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          }`}
          aria-hidden={!showTip}
        >
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
          <span className="whitespace-nowrap text-[12px] font-semibold text-accent">
            You&apos;ve asked this before
          </span>
          <span className="truncate text-[11.5px] text-ink-soft">{REMEMBERED}</span>
        </div>
      </div>

      <div className="min-h-[56px] rounded-btn border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink">
        {typed}
        {phase === 'typing' && (
          <span
            aria-hidden
            className="ml-px inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-accent"
          />
        )}
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
