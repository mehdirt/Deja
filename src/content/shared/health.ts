import type { Platform } from '@/lib/types'
import { onHealthChange, writeHealth } from '@/lib/health'

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
  /**
   * Told about every transition, so the in-page dot can offer a hand-save the
   * moment capture stops working here. Until now this signal only reached
   * settings, which meant a broken selector was invisible exactly where the
   * person was standing.
   */
  onChange?: (ok: boolean) => void,
): () => void {
  // What we believe the *stored* health is, so we only write on transitions.
  // Starts null so the first probe always writes.
  let healthy: boolean | null = null

  const report = (ok: boolean) => {
    if (ok === healthy) return // only persist on transitions
    healthy = ok
    void writeHealth(platform, ok)
    try {
      onChange?.(ok)
    } catch {
      /* a listener must never break the probe */
    }
  }

  // capture.ts also marks a platform unhealthy when the *message pipeline*
  // fails, not just when the selector drifts — and it writes straight to
  // storage, bypassing this module's `healthy` flag. Without hearing about it,
  // the probe would keep believing the stored value is `true`, so its next
  // recheck would find the composer, call report(true), see "no transition",
  // and write nothing. The stored value would stay `false` forever and the dot
  // would stay amber for the life of the page even though capture recovered.
  // Syncing on every external change keeps the probe authoritative for
  // recovery.
  const unsubHealth = onHealthChange((health) => {
    const entry = health[platform]
    if (entry && entry.ok !== healthy) healthy = entry.ok
  })

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
    unsubHealth()
  }
}
