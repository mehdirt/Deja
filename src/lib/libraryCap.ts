// Optional library size cap — when live prompts exceed a threshold, hard-delete
// the least-used ones (oldest first on a tie). Favorites are never touched.
// Intake filters + near-dup collapse remain the primary growth control; this is
// a high default ceiling (5000) for very large libraries.

import { bulkHardDelete, db } from './db'
import type { Prompt } from './types'

/** 0 = no limit. Default is a high ceiling so everyday libraries rarely feel it. */
export const LIBRARY_CAP_OFF = 0
export const LIBRARY_CAP_DEFAULT = 5000

export const LIBRARY_CAP_CHOICES = [0, 2000, 5000, 10000] as const
export type LibraryCapChoice = (typeof LIBRARY_CAP_CHOICES)[number]

export function coerceLibraryCap(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return LIBRARY_CAP_DEFAULT
  const n = Math.floor(raw)
  if (n <= 0) return LIBRARY_CAP_OFF
  if ((LIBRARY_CAP_CHOICES as readonly number[]).includes(n)) return n
  // Unknown stored value: clamp to nearest allowed positive choice.
  const positives = LIBRARY_CAP_CHOICES.filter((c) => c > 0)
  let best = LIBRARY_CAP_DEFAULT
  let bestDist = Infinity
  for (const c of positives) {
    const d = Math.abs(c - n)
    if (d < bestDist) {
      best = c
      bestDist = d
    }
  }
  return best
}

type CapRow = Pick<Prompt, 'id' | 'usageCount' | 'createdAt' | 'pinned' | 'deletedAt'>

/** Pure: which ids to soft-delete to bring live count down to `cap`. */
export function pickTrimIds(prompts: CapRow[], cap: number): number[] {
  if (cap <= 0) return []
  const live = prompts.filter((p) => !p.deletedAt && p.id != null)
  const overflow = live.length - cap
  if (overflow <= 0) return []

  return live
    .filter((p) => !p.pinned)
    .sort((a, b) => {
      const byUsage = (a.usageCount ?? 0) - (b.usageCount ?? 0)
      if (byUsage !== 0) return byUsage
      return (a.createdAt ?? 0) - (b.createdAt ?? 0)
    })
    .slice(0, overflow)
    .map((p) => p.id as number)
}

/** Hard-delete least-used live prompts until count ≤ cap. Returns how many.
 *  No Undo window — auto-tidy is opt-in and has no per-row restore UI. */
export async function trimLibraryToCap(cap: number): Promise<number> {
  const limit = coerceLibraryCap(cap)
  if (limit <= 0) return 0
  const all = await db.prompts.toArray()
  const ids = pickTrimIds(all, limit)
  if (!ids.length) return 0
  await bulkHardDelete(ids)
  return ids.length
}
