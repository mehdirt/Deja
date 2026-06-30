import { useEffect, useState } from 'react'
import { readPrefs, writePrefs, onPrefsChange, PAUSE_FOREVER } from '@/lib/prefs'

// The capture pause control. Lives in the popup (the natural "off switch"
// surface). Pausing is the highest-leverage trust affordance: one click to stop
// recording before a private session, with a visible, self-clearing state.
//
// Capture resumes on its own when a timed pause elapses (the content gate checks
// the time live); this component only reflects/sets the stored pauseUntil and
// ticks a live countdown while paused.

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
  const [choosing, setChoosing] = useState(false)

  useEffect(() => {
    void readPrefs().then((p) => setPauseUntil(p.pauseUntil))
    return onPrefsChange((p) => setPauseUntil(p.pauseUntil))
  }, [])

  const paused = pauseUntil > now

  // Tick once a second while a timed pause is counting down, so the label stays
  // honest and the control flips back to "active" the moment it elapses.
  useEffect(() => {
    if (!paused || pauseUntil === PAUSE_FOREVER) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [paused, pauseUntil])

  const pause = (until: number) => {
    setChoosing(false)
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
        <span className="font-mono text-xs text-[#c98a2b]">
          ⏸ capture paused{label ? ` · ${label}` : ''}
        </span>
        <button onClick={resume} className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-xs">
          resume
        </button>
      </div>
    )
  }

  if (choosing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-btn border border-line bg-sunk px-3 py-1.5">
        <span className="font-mono text-xs text-ink-soft">pause capture for…</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => pause(Date.now() + HOUR)}
            className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-xs"
          >
            1 hour
          </button>
          <button
            onClick={() => pause(PAUSE_FOREVER)}
            className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-xs"
          >
            until I resume
          </button>
          <button
            onClick={() => setChoosing(false)}
            aria-label="Cancel"
            className="dj-btn dj-btn-ghost px-1.5 py-0.5 font-mono text-xs text-ink-faint"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end">
      <button
        onClick={() => setChoosing(true)}
        className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-xs text-ink-faint hover:text-ink"
      >
        ⏸ pause capture
      </button>
    </div>
  )
}
