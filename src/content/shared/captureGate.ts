import { readPrefs, onPrefsChange, isPaused, DEFAULT_PREFS, type Prefs } from '@/lib/prefs'
import type { Platform } from '@/lib/types'

// Content-script side of the capture controls (pause + per-site switches). Like
// the blocklist cache, the capture hot path must decide synchronously (no awaits
// — we have a <100ms budget), so we load the relevant prefs once and keep an
// in-memory snapshot fresh via the onChanged subscription.
//
// FAIL OPEN: until the first load resolves (and if it ever fails) we assume
// capturing is allowed. A storage glitch must never silently stop capture — the
// gate is a control on top of capture, not a prerequisite for it. The one
// deliberate exception is incognito auto-pause (see isIncognito): a private
// window should err toward NOT recording.

let snapshot: Prefs = { ...DEFAULT_PREFS }
let platform: Platform | null = null

// True only in an incognito context where the user allowed the extension to run.
// chrome.extension.inIncognitoContext is available to content scripts; guarded
// because it can be absent in odd/orphaned contexts.
function isIncognito(): boolean {
  try {
    return !!chrome.extension?.inIncognitoContext
  } catch {
    return false
  }
}

/**
 * Synchronous: may we capture / resurface on this page right now? False when the
 * site is switched off, capture is paused, or we're in an auto-paused incognito
 * window. Live (re-reads Date.now each call) so a duration pause resumes on its
 * own without any timer.
 */
export function shouldCapture(): boolean {
  if (platform && snapshot.sites[platform] === false) return false
  if (snapshot.autoPauseIncognito && isIncognito()) return false
  if (isPaused(snapshot)) return false
  return true
}

/**
 * Load the gate prefs once and subscribe to changes. `platform` scopes the
 * per-site switch. Returns `{ shouldCapture, ready }`; `ready` resolves when the
 * first read lands or after a 1000ms fallback (so capture still arms if storage
 * hangs — fail open). Never rejects.
 */
export function startCaptureGate(p: Platform): {
  shouldCapture: () => boolean
  ready: Promise<void>
} {
  platform = p

  const ready = new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const timer = setTimeout(done, 1000)
    void readPrefs()
      .then((p2) => {
        snapshot = p2
      })
      .catch(() => {
        /* fail open — keep defaults */
      })
      .finally(() => {
        clearTimeout(timer)
        done()
      })
  })

  try {
    onPrefsChange((p2) => {
      snapshot = p2
    })
  } catch {
    /* ignore — keep current snapshot */
  }

  return { shouldCapture, ready }
}
