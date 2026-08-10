// User preferences — small, non-sensitive settings that both the options UI and
// the content scripts read. Persisted in chrome.storage.local with the same
// shape discipline as blocklist.ts / health.ts (typed read/write + onChanged
// subscription). Nothing here ever leaves the machine.
//
// FAIL SAFE: if storage can't be read, we fall back to DEFAULT_PREFS. Insert
// on click is the product default; a storage glitch still never auto-fills —
// the content script only writes the host page on an explicit suggestion click.

// What clicking a resurface match does:
//   - 'copy'   → copy the prior prompt to the clipboard (opt-out; non-destructive)
//   - 'insert' → clear the composer and type the remembered prompt in (default;
//                the content script writes to the host page only on this click)
import { LIBRARY_CAP_DEFAULT, coerceLibraryCap } from './libraryCap'
import {
  PLATFORM_LABEL,
  PII_KINDS,
  PII_NER_KINDS,
  PII_STRUCTURED_KINDS,
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
  // Selective capture strength. 'balanced' (default) skips obvious throwaways;
  // 'off' saves everything; 'strict' saves only substantial prompts. See
  // classify.ts. (Replaces the earlier boolean `keepMinor`, migrated below.)
  filterStrength: FilterStrength
  // Whether the user has already seen the one-time "we skipped a short prompt"
  // explanation. Set the first time a minor prompt is skipped so we inform
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
  // When true, remember the original values behind [email_1] etc. in a private
  // local vault (never in backups) so Fill-in can offer them again. On by default.
  rememberHiddenDetails: boolean
  // Opt-in on-device NER for names / street-like places. Off by default; turning
  // it on downloads a small model once (see nerStatus / offscreen). Prompt text
  // never leaves the device.
  nerNamesPlaces: boolean
  // Soft size cap on live prompts. 0 = no limit; default 5000. When over,
  // least-used (then oldest) are removed; favorites are never touched.
  // See libraryCap.ts.
  libraryCap: number
  // ── In-page surfaces ───────────────────────────────────────────────────────
  // A small Deja button in the corner of the chat box. On by default: without
  // it, Deja is invisible unless the similarity threshold happens to fire, and
  // an extension nobody sees is an extension nobody keeps. Turning it off
  // removes the element entirely (and with it the hand-save offer, which is a
  // third state of the same dot).
  inPageDot: boolean
  // Typing `//` in the chat box opens a search over everything saved. On by
  // default; it costs nothing until those two characters are typed.
  slashPicker: boolean
  // Let the order of suggestions follow what the user actually reuses. On by
  // default. Local only — this never leaves the machine, and no score is ever
  // shown to (or about) the person.
  learnFromUse: boolean
  // Which everyday topics the person said they use AI for, from the welcome
  // chips. Purely cosmetic: it picks which starter examples show while the
  // library is empty. Empty means "show them all" — skipping is a real choice.
  intents: string[]
  // Whether the welcome demo has played once. After that it shows its final
  // frame with a play button instead of looping at a returning visitor.
  welcomeDemoSeen: boolean
}

function allSitesEnabled(): Record<Platform, boolean> {
  return Object.fromEntries(ALL_PLATFORMS.map((p) => [p, true])) as Record<Platform, boolean>
}

/** Structured kinds on; NER kinds off until the user opts in. */
function defaultPiiKinds(): Record<PiiKind, boolean> {
  const out = Object.fromEntries(PII_KINDS.map((k) => [k, false])) as Record<PiiKind, boolean>
  for (const k of PII_STRUCTURED_KINDS) out[k] = true
  return out
}

export const DEFAULT_PREFS: Prefs = {
  resurfaceClick: 'insert',
  filterStrength: 'balanced',
  minorNoticeSeen: false,
  pauseUntil: 0,
  autoPauseIncognito: true,
  sites: allSitesEnabled(),
  redactPii: true,
  piiKinds: defaultPiiKinds(),
  rememberHiddenDetails: true,
  nerNamesPlaces: false,
  libraryCap: LIBRARY_CAP_DEFAULT,
  inPageDot: true,
  slashPicker: true,
  learnFromUse: true,
  intents: [],
  welcomeDemoSeen: false,
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
  const out = defaultPiiKinds()
  for (const k of PII_KINDS) {
    if (obj[k] === false) out[k] = false
    if (obj[k] === true) out[k] = true
  }
  // Legacy installs had no person/place keys — keep NER kinds off unless set.
  for (const k of PII_NER_KINDS) {
    if (obj[k] !== true) out[k] = false
  }
  return out
}

// Starter-example topics. Kept loose (a plain string[]) in storage but coerced
// against this list, so a stale or hand-edited value can never make the empty
// library show nothing.
export const INTENTS = ['email', 'planning', 'learning', 'everyday'] as const
export type Intent = (typeof INTENTS)[number]

function coerceIntents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v === 'string' && (INTENTS as readonly string[]).includes(v) && !out.includes(v)) {
      out.push(v)
    }
  }
  return out
}

function coerce(raw: unknown): Prefs {
  const obj = (raw ?? {}) as Partial<Prefs> & { keepMinor?: unknown }
  return {
    resurfaceClick: obj.resurfaceClick === 'copy' ? 'copy' : 'insert',
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
    rememberHiddenDetails: obj.rememberHiddenDetails !== false,
    nerNamesPlaces: obj.nerNamesPlaces === true,
    libraryCap: coerceLibraryCap(obj.libraryCap),
    // On-by-default booleans use `!== false` so an install predating the key
    // gets the new behaviour, and only an explicit opt-out turns it off.
    inPageDot: obj.inPageDot !== false,
    slashPicker: obj.slashPicker !== false,
    learnFromUse: obj.learnFromUse !== false,
    intents: coerceIntents(obj.intents),
    welcomeDemoSeen: obj.welcomeDemoSeen === true,
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
//
// Each call does its own read-then-write, so two writePrefs() calls fired
// back-to-back in the SAME context (e.g. two rapid Settings toggles before
// the first await resolves) can race and drop one update. Chaining onto a
// module-scope promise serializes calls within this context. It does NOT
// serialize across contexts (popup vs. options vs. background each load
// their own instance of this module) — that race is smaller in practice
// (different tabs rarely toggle the same setting at the same instant) and
// closing it fully would need a single mediating writer or a CAS primitive
// chrome.storage.local doesn't offer.
let writeChain: Promise<void> = Promise.resolve()

export function writePrefs(patch: Partial<Prefs>): Promise<void> {
  writeChain = writeChain.catch(() => {}).then(async () => {
    try {
      const current = await readPrefs()
      await chrome.storage.local.set({ [KEY]: coerce({ ...current, ...patch }) })
    } catch {
      /* storage unavailable — never throw into the host page */
    }
  })
  return writeChain
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
