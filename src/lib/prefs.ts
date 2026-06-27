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
}

export const DEFAULT_PREFS: Prefs = { resurfaceClick: 'copy' }

const KEY = 'prefs'

function coerce(raw: unknown): Prefs {
  const obj = (raw ?? {}) as Partial<Prefs>
  const resurfaceClick: ResurfaceClick = obj.resurfaceClick === 'insert' ? 'insert' : 'copy'
  return { resurfaceClick }
}

export async function readPrefs(): Promise<Prefs> {
  try {
    const res = await chrome.storage.local.get(KEY)
    return coerce(res?.[KEY])
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export async function writePrefs(prefs: Prefs): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: coerce(prefs) })
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
