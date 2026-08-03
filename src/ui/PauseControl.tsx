import { useEffect, useRef, useState } from 'react'
import { readPrefs, writePrefs, onPrefsChange, PAUSE_FOREVER } from '@/lib/prefs'

// The capture pause control. Lives in the popup (the natural "off switch"
// surface). It shows the current state plainly — a green "capturing" row, or an
// amber "paused" row with a live countdown — and a small dropdown to choose how
// long to pause. Capture resumes on its own when a timed pause elapses (the
// content gate checks the time live); this only reflects/sets the stored
// pauseUntil and ticks the countdown.

const HOUR = 3_600_000

function remainingLabel(pauseUntil: number, now: number): string {
  if (pauseUntil === PAUSE_FOREVER) return 'until you turn it back on'
  const ms = pauseUntil - now
  if (ms <= 0) return ''
  const mins = Math.ceil(ms / 60_000)
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}m left` : `${h}h left`
  }
  if (mins > 1) return `${mins} min left`
  return 'less than a minute left'
}

export function PauseControl() {
  const [pauseUntil, setPauseUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void readPrefs().then((p) => setPauseUntil(p.pauseUntil))
    return onPrefsChange((p) => setPauseUntil(p.pauseUntil))
  }, [])

  const paused = pauseUntil > now

  // Tick once a second while a timed pause counts down, so the label stays
  // honest and the control flips back to "capturing" the moment it elapses.
  useEffect(() => {
    if (!paused || pauseUntil === PAUSE_FOREVER) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [paused, pauseUntil])

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pause = (until: number) => {
    setOpen(false)
    setNow(Date.now())
    setPauseUntil(until)
    void writePrefs({ pauseUntil: until })
  }
  const resume = () => {
    setPauseUntil(0)
    void writePrefs({ pauseUntil: 0 })
  }

  if (paused) {
    const label = remainingLabel(pauseUntil, now)
    return (
      <div className="flex items-center justify-between gap-2 rounded-btn border border-warn/40 bg-warn/10 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-warn">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
          Paused{label ? ` · ${label}` : ''}
        </span>
        <button onClick={resume} className="dj-btn dj-btn-ghost px-2 py-0.5 text-xs">
          Resume
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between gap-2 rounded-btn border border-line px-3 py-1.5">
        <span className="inline-flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
          Quietly saving for you
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="dj-btn dj-btn-ghost gap-1 px-2 py-0.5 text-xs"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2" width="3.5" height="12" rx="1" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
          </svg>
          Pause
        </button>
      </div>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-btn border border-line bg-surface shadow-pop"
        >
          <button
            role="menuitem"
            onClick={() => pause(Date.now() + HOUR)}
            className="block w-full px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-sunk"
          >
            Pause for an hour
          </button>
          <button
            role="menuitem"
            onClick={() => pause(PAUSE_FOREVER)}
            className="block w-full px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-sunk"
          >
            Pause until I turn it back on
          </button>
        </div>
      )}
    </div>
  )
}
