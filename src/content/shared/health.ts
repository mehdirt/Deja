import type { Platform } from '@/lib/types'
import { writeHealth } from '@/lib/health'

// On every supported page, probe whether we can still find the prompt input.
// SPA inputs render late, so we poll with backoff on load; then we re-probe
// slowly for the life of the page so a selector that breaks mid-session
// flips us to unhealthy. We only write on *transitions* to keep storage
// churn near zero. Everything is wrapped — a probe must never disturb the
// host page.

const PROBE_INTERVAL_MS = 500
const PROBE_MAX_TRIES = 20 // ~10s of backoff for the initial async render
const RECHECK_INTERVAL_MS = 30_000

export function startHealthProbe(
  getInput: () => HTMLElement | null,
  platform: Platform,
): () => void {
  let healthy: boolean | null = null

  const report = (ok: boolean) => {
    if (ok === healthy) return // only persist on transitions
    healthy = ok
    void writeHealth(platform, ok)
  }

  // Initial probe: keep looking until the input shows up or we give up.
  let tries = 0
  const initial = window.setInterval(() => {
    tries += 1
    if (getInput()) {
      report(true)
      window.clearInterval(initial)
    } else if (tries >= PROBE_MAX_TRIES) {
      report(false)
      window.clearInterval(initial)
    }
  }, PROBE_INTERVAL_MS)

  // Slow re-probe so a later DOM change either breaks or restores capture.
  const recheck = window.setInterval(() => {
    report(!!getInput())
  }, RECHECK_INTERVAL_MS)

  return () => {
    window.clearInterval(initial)
    window.clearInterval(recheck)
  }
}
