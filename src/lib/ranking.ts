import type { Prompt } from './types'

// "Most useful" ranking — weights how often a prompt has been reused against
// how recently it was last used, so a prompt you lean on often and recently
// floats to the top. Pure and exported so it can be unit-tested without a DB.
//
// Shape: usefulness = (usageCount + 1) * recencyDecay(lastUsedAt)
//   - usageCount + 1 means a never-used prompt still gets a nonzero score
//     (so recency alone can rank fresh, unused prompts sensibly) while each
//     additional use multiplies its standing.
//   - recencyDecay is exponential with a ~14-day half-life: a prompt used
//     today scores ~1.0, two weeks ago ~0.5, a month ago ~0.25. This makes
//     recency the natural tie-breaker between two equally-used prompts.
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000

export function usefulnessScore(
  prompt: Pick<Prompt, 'usageCount' | 'lastUsedAt'>,
  now: number,
): number {
  const usage = (prompt.usageCount ?? 0) + 1
  const age = Math.max(0, now - (prompt.lastUsedAt ?? 0))
  const recency = Math.pow(0.5, age / HALF_LIFE_MS)
  return usage * recency
}
