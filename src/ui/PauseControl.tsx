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
  if (pauseUntil === PAUSE_FOREVER) return 'until you resume'
  const ms = pauseUntil - now
  if (ms <= 0) return ''
  const mins = Math.ceil(ms / 60_000)
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}m left` : `${h}h left`
  }
  if (mins > 1) return `${mins}m left`
  return 'under a minute left'
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
      <div className="flex items-center justify-between gap-2 rounded-btn border border-[#c98a2b]/40 bg-[#c98a2b]/10 px-3 py-1.5">
        <span className="inline-flex items-center gap-2 font-mono text-xs text-[#c98a2b]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#c98a2b]" aria-hidden />
          capture paused{label ? ` · ${label}` : ''}
        </span>
        <button onClick={resume} className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-xs">
          resume
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between gap-2 rounded-btn border border-line px-3 py-1.5">
        <span className="inline-flex items-center gap-2 font-mono text-xs text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
          capturing
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-xs"
        >
          ⏸ pause
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
            className="block w-full px-3 py-2 text-left font-mono text-xs text-ink transition-colors hover:bg-sunk"
          >
            pause for 1 hour
          </button>
          <button
            role="menuitem"
            onClick={() => pause(PAUSE_FOREVER)}
            className="block w-full px-3 py-2 text-left font-mono text-xs text-ink transition-colors hover:bg-sunk"
          >
            pause until I resume
          </button>
        </div>
      )}
    </div>
  )
}
