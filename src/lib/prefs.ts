// User preferences — small, non-sensitive settings that both the options UI and
// the content scripts read. Persisted in chrome.storage.local with the same
// shape discipline as blocklist.ts / health.ts (typed read/write + onChanged
// subscription). Nothing here ever leaves the machine.
//
// FAIL SAFE: if storage can't be read, we fall back to DEFAULT_PREFS. The
// default for the resurface click is the conservative one (copy, not insert),
// so a storage glitch can never cause the extension to start writing into the
// host page on its own.

// What clicking a resurface match does:
//   - 'copy'   → copy the prior prompt to the clipboard (default; non-destructive)
//   - 'insert' → insert it at the caret in the composer (opt-in; the content
//                script writes to the host page only on this explicit click)
import {
  PLATFORM_LABEL,
  PII_KINDS,
  type FilterStrength,
  type Platform,
  type PiiKind,
} from './types'

export type ResurfaceClick = 'copy' | 'insert'

const ALL_PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[]

// Sentinel for "paused until I turn it back on" (no expiry). Any real timestamp
// is far below this, so `pauseUntil > now` reads as paused forever.
export const PAUSE_FOREVER = Number.MAX_SAFE_INTEGER

export interface Prefs {
  resurfaceClick: ResurfaceClick
  // Selective capture strength. 'balanced' (default) hides obvious throwaways;
  // 'off' keeps everything; 'strict' keeps only substantial prompts. See
  // classify.ts. (Replaces the earlier boolean `keepMinor`, migrated below.)
  filterStrength: FilterStrength
  // Whether the user has already seen the one-time "we skipped a short prompt"
  // explanation. Set the first time a minor prompt is filtered so we inform
  // once and then stay quiet (never nag).
  minorNoticeSeen: boolean
  // Pause capture. 0 = capturing; otherwise an epoch-ms instant capture is
  // paused until (PAUSE_FOREVER = until manually resumed). The capture/resurface
  // hot paths check this live, so capture resumes on its own when the time
  // passes — no timer required for correctness (the toolbar badge uses an alarm
  // only to look right).
  pauseUntil: number
  // Auto-pause in incognito windows (when the user has allowed the extension to
  // run there at all). On by default — the safe choice for a private session.
  autoPauseIncognito: boolean
  // Per-site capture switches. A site set to false captures nothing (and
  // resurface stays quiet there). Missing entry = enabled.
  sites: Record<Platform, boolean>
  // Redact personal info (email, cards, secrets, …) from a prompt before it's
  // stored. On by default. `piiKinds` toggles individual categories.
  redactPii: boolean
  piiKinds: Record<PiiKind, boolean>
}

function allSitesEnabled(): Record<Platform, boolean> {
  return Object.fromEntries(ALL_PLATFORMS.map((p) => [p, true])) as Record<Platform, boolean>
}

function allPiiEnabled(): Record<PiiKind, boolean> {
  return Object.fromEntries(PII_KINDS.map((k) => [k, true])) as Record<PiiKind, boolean>
}

export const DEFAULT_PREFS: Prefs = {
  resurfaceClick: 'copy',
  filterStrength: 'balanced',
  minorNoticeSeen: false,
  pauseUntil: 0,
  autoPauseIncognito: true,
  sites: allSitesEnabled(),
  redactPii: true,
  piiKinds: allPiiEnabled(),
}

const KEY = 'prefs'

function coerceStrength(raw: Partial<Prefs> & { keepMinor?: unknown }): FilterStrength {
  if (
    raw.filterStrength === 'off' ||
    raw.filterStrength === 'strict' ||
    raw.filterStrength === 'balanced'
  )
    return raw.filterStrength
  // Migrate the legacy boolean: keepMinor === true meant "filter nothing".
  if (raw.keepMinor === true) return 'off'
  return 'balanced'
}

function coerceSites(raw: unknown): Record<Platform, boolean> {
  const obj = (raw ?? {}) as Partial<Record<Platform, unknown>>
  const out = allSitesEnabled()
  for (const p of ALL_PLATFORMS) if (obj[p] === false) out[p] = false
  return out
}

function coercePiiKinds(raw: unknown): Record<PiiKind, boolean> {
  const obj = (raw ?? {}) as Partial<Record<PiiKind, unknown>>
  const out = allPiiEnabled()
  for (const k of PII_KINDS) if (obj[k] === false) out[k] = false
  return out
}

function coerce(raw: unknown): Prefs {
  const obj = (raw ?? {}) as Partial<Prefs> & { keepMinor?: unknown }
  return {
    resurfaceClick: obj.resurfaceClick === 'insert' ? 'insert' : 'copy',
    filterStrength: coerceStrength(obj),
    minorNoticeSeen: obj.minorNoticeSeen === true,
    pauseUntil:
      typeof obj.pauseUntil === 'number' && Number.isFinite(obj.pauseUntil) && obj.pauseUntil > 0
        ? obj.pauseUntil
        : 0,
    autoPauseIncognito: obj.autoPauseIncognito !== false,
    sites: coerceSites(obj.sites),
    redactPii: obj.redactPii !== false,
    piiKinds: coercePiiKinds(obj.piiKinds),
  }
}

/** True when capture is currently paused by the pause-until timer. Pure. */
export function isPaused(prefs: Prefs, now = Date.now()): boolean {
  return prefs.pauseUntil > now
}

export async function readPrefs(): Promise<Prefs> {
  try {
    const res = await chrome.storage.local.get(KEY)
    return coerce(res?.[KEY])
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

// Merge a partial update into the stored prefs. Merging (rather than
// overwriting) means a caller that only knows about one setting — e.g. the
// settings UI saving `resurfaceClick`, or the background stamping
// `minorNoticeSeen` — can never clobber another preference it didn't pass.
export async function writePrefs(patch: Partial<Prefs>): Promise<void> {
  try {
    const current = await readPrefs()
    await chrome.storage.local.set({ [KEY]: coerce({ ...current, ...patch }) })
  } catch {
    /* storage unavailable — never throw into the host page */
  }
}

/** Subscribe to preference changes so an open settings view / content script
 *  stays in sync. Returns an unsubscribe function. */
export function onPrefsChange(cb: (prefs: Prefs) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) cb(coerce(changes[KEY].newValue))
  }
  try {
    chrome.storage.onChanged.addListener(listener)
  } catch {
    return () => {}
  }
  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener)
    } catch {
      /* ignore */
    }
  }
}
