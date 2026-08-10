import { listPrompts } from '@/lib/db'
import type { Prompt } from '@/lib/types'

// A worker-scope cache of the prompt list.
//
// WHY NOW. ROADMAP.md flagged this as "deferred until it bites": every
// debounced keystroke made SIMILAR_QUERY re-read the whole prompts table and
// trigram-scan it. That was survivable with one reader. The `//` picker adds a
// second full-table read per keystroke on a *tighter* debounce (120ms vs
// 400ms), so on a few-thousand-row library we'd be doing two full scans, ten
// times a second, against the extension's own latency budget. It bites now.
//
// WHAT THIS IS NOT. Still no inverted index, still no precomputed trigram sets
// — those are the next step *if* real libraries feel slow with this in place.
// This only removes the IndexedDB round-trip, which is the cheap half and the
// one we can be sure about.
//
// SAFE TO LOSE. MV3 workers are killed constantly; when this one dies the cache
// dies with it and the next read repopulates. That's the whole correctness
// story — there is no persistence and no invalidation across contexts, because
// this module is the only reader and every writer lives in the same worker.

interface Entry {
  rows: Prompt[]
  at: number
}

// Keyed by includeMinor: the two pools have different contents, and callers
// pick based on the user's filter strength.
let full: Entry | null = null
let live: Entry | null = null

// A ceiling on staleness for the one case we don't control: a write that
// happens somewhere we forgot to invalidate (or in another context — the
// options page deletes through db.ts directly, not through us). Without it a
// long-lived worker could serve a stale pool indefinitely. Short enough that a
// missed invalidation is a blink, long enough that a burst of keystrokes still
// hits the cache.
const MAX_AGE_MS = 30_000

/**
 * The prompt pool, cached in worker scope. Never throws — on a DB error the
 * caller gets an empty pool, the same shape a genuinely empty library has.
 */
export async function getPool(includeMinor: boolean): Promise<Prompt[]> {
  const slot = includeMinor ? full : live
  if (slot && Date.now() - slot.at < MAX_AGE_MS) return slot.rows

  try {
    const rows = await listPrompts({ includeMinor })
    const entry: Entry = { rows, at: Date.now() }
    if (includeMinor) full = entry
    else live = entry
    return rows
  } catch {
    return slot?.rows ?? []
  }
}

/**
 * Drop the cache. Call after ANY write that changes what a read would return.
 *
 * That includes the two that are easy to forget because they only bump
 * counters: touchUsage (via PROMPT_USED / a duplicate capture) and touchDismiss
 * (via SUGGESTION_DISMISSED). Those are exactly the fields suggestion ordering
 * reads, so missing them would leave the learned order silently lagging a whole
 * worker lifetime behind the signals meant to drive it.
 */
export function invalidatePool(): void {
  full = null
  live = null
}
