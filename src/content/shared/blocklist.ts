import {
  readBlocklist,
  onBlocklistChange,
  EMPTY_BLOCKLIST,
  type Blocklist,
} from '@/lib/blocklist'

// Content-script side of the blocklist. The capture hot path must check the
// blocklist *synchronously* (no awaits — we have a <100ms budget and don't
// want to add latency per keystroke/submit). So we load the blocklist once on
// init and keep an in-memory snapshot fresh via the onChanged subscription.
//
// Fail open: until the first load resolves (and if it ever fails) the snapshot
// is the empty blocklist, i.e. capture everything.

let snapshot: Blocklist = { ...EMPTY_BLOCKLIST }

/** Synchronous accessor for the current cached blocklist. */
export function getBlocklist(): Blocklist {
  return snapshot
}

/**
 * Load the blocklist once and subscribe to changes. Idempotent enough for a
 * single content-script init.
 *
 * Returns `{ getBlocklist, ready }`. `ready` resolves when the first
 * `readBlocklist()` completes OR after a 1000ms fallback (whichever is first),
 * so a caller can gate capture-arming on it to close the page-load race where
 * a blocklisted prompt slips through before the first read lands. The fallback
 * guarantees capture still arms even if storage hangs — fail-open survives a
 * stuck read. `ready` never rejects and resolves idempotently.
 */
export function startBlocklistSync(): {
  getBlocklist: () => Blocklist
  ready: Promise<void>
} {
  const ready = new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }

    // Fallback: arm capture after 1s even if the storage read hangs, so a
    // failed/slow read can never permanently stop capture (fail open).
    const timer = setTimeout(done, 1000)

    // Initial async load. Errors inside readBlocklist already resolve to the
    // empty blocklist (fail open), so we never throw here.
    void readBlocklist()
      .then((bl) => {
        snapshot = bl
      })
      .catch(() => {
        /* fail open — keep the empty snapshot */
      })
      .finally(() => {
        clearTimeout(timer)
        done()
      })
  })

  // Keep the cache fresh. If subscribing throws (orphaned context), we simply
  // keep the last snapshot.
  try {
    onBlocklistChange((bl) => {
      snapshot = bl
    })
  } catch {
    /* ignore — keep current snapshot */
  }

  return { getBlocklist, ready }
}
