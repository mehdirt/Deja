// Capture blocklist — opt-in privacy protection layered on top of a
// capture-everything default. Two kinds of rule:
//   - domains: don't capture at all on these hosts (e.g. a sensitive site)
//   - patterns: user regexes; if any matches the prompt text, skip the capture
//     so password-/secret-shaped strings never get stored.
//
// Persisted in chrome.storage.local — same place and shape discipline as
// health.ts (typed read/write + onChanged subscription). Nothing here ever
// leaves the machine; it only ever *prevents* a write.
//
// FAIL OPEN is the governing rule: if storage can't be read, we default to an
// empty blocklist (capture everything). A storage glitch must never silently
// stop capture — the blocklist is protection on top of capture, not a gate in
// front of it.

export interface Blocklist {
  /** Host substrings to block (case-insensitive). e.g. "claude.ai". */
  domains: string[]
  /** User-supplied regex source strings, matched against prompt text. */
  patterns: string[]
}

export const EMPTY_BLOCKLIST: Blocklist = { domains: [], patterns: [] }

const KEY = 'captureBlocklist'

function coerce(raw: unknown): Blocklist {
  const obj = (raw ?? {}) as Partial<Blocklist>
  const domains = Array.isArray(obj.domains)
    ? obj.domains.filter((d): d is string => typeof d === 'string')
    : []
  const patterns = Array.isArray(obj.patterns)
    ? obj.patterns.filter((p): p is string => typeof p === 'string')
    : []
  return { domains, patterns }
}

export async function readBlocklist(): Promise<Blocklist> {
  try {
    const res = await chrome.storage.local.get(KEY)
    return coerce(res?.[KEY])
  } catch {
    // Fail open: a read error means "no rules", i.e. keep capturing.
    return { ...EMPTY_BLOCKLIST }
  }
}

export async function writeBlocklist(bl: Blocklist): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: coerce(bl) })
  } catch {
    /* storage unavailable — never throw into the host page */
  }
}

/** Subscribe to blocklist changes so an open settings view / content-script
 *  cache stays fresh. Returns an unsubscribe function. */
export function onBlocklistChange(cb: (bl: Blocklist) => void): () => void {
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

/** Best-effort host extraction from a URL. Returns lowercased host, or the
 *  lowercased raw string if it doesn't parse (so a bare host still matches). */
function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

// PURE matcher — no storage, no DOM. Safe to call synchronously in the
// capture hot path. Returns true if this (url, text) pair should NOT be
// captured.
//
// Invalid user regexes are compiled inside try/catch and skipped; a bad
// pattern must never throw into capture. An empty blocklist blocks nothing.
export function isBlocked(url: string, text: string, bl: Blocklist): boolean {
  const host = hostOf(url)
  for (const d of bl.domains) {
    const needle = d.trim().toLowerCase()
    if (needle && host.includes(needle)) return true
  }
  for (const src of bl.patterns) {
    if (!src.trim()) continue
    try {
      const re = new RegExp(src)
      if (re.test(text)) return true
    } catch {
      // Invalid regex — skip it. Never let it throw into the capture path.
      continue
    }
  }
  return false
}
