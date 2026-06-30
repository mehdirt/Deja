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
export type ResurfaceClick = 'copy' | 'insert'

export interface Prefs {
  resurfaceClick: ResurfaceClick
  // Selective capture. When false (default), prompts the classifier judges
  // "minor" (short throwaways) are stored but hidden from the library and
  // resurface. When true, every prompt is kept and shown — the filter is off.
  keepMinor: boolean
  // Whether the user has already seen the one-time "we skipped a short prompt"
  // explanation. Set the first time a minor prompt is filtered so we inform
  // once and then stay quiet (never nag).
  minorNoticeSeen: boolean
}

export const DEFAULT_PREFS: Prefs = {
  resurfaceClick: 'copy',
  keepMinor: false,
  minorNoticeSeen: false,
}

const KEY = 'prefs'

function coerce(raw: unknown): Prefs {
  const obj = (raw ?? {}) as Partial<Prefs>
  return {
    resurfaceClick: obj.resurfaceClick === 'insert' ? 'insert' : 'copy',
    keepMinor: obj.keepMinor === true,
    minorNoticeSeen: obj.minorNoticeSeen === true,
  }
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
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
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
