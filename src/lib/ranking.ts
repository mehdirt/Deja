import type { Prompt } from './types'

// "Handy lately" ranking — weights how often a prompt has been reused against
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

// ── Suggestion ordering ──────────────────────────────────────────────────────
//
// A prompt you have reached for before should beat a slightly closer one you
// have never touched. That is the whole idea; everything below is about making
// sure it stays a *tie-breaker* and never becomes the main event.
//
// These constants are provisional, like the similarity thresholds they sit
// next to. They get tuned by watching real reactions, not by being guessed a
// second time.

/** How much of the final score comes from lexical similarity. */
const SIMILARITY_WEIGHT = 0.8
/**
 * The usefulness value at which a prompt has earned half the standing bonus
 * available. Small on purpose: the bonus should arrive quickly for a prompt
 * you use, then flatten out, rather than growing forever with usage.
 */
const STANDING_K = 3

/**
 * Blend how well a prompt matches with how the person has actually treated it.
 *
 * The normalisation is load-bearing, not a detail. `similarity()` returns
 * [0, 1] but `usefulnessScore()` is unbounded — it is `(usageCount + 1) ×
 * recencyDecay`, so a prompt used daily reaches double digits. Blending the raw
 * value would let standing dominate outright instead of breaking ties, which is
 * the opposite of what we want. Squashing it through `x / (x + K)` keeps it in
 * [0, 1) for any usage count, so the 0.8 weight on similarity actually holds.
 *
 * Saturating rather than pool-relative is also deliberate: normalising against
 * the rest of the library would make one prompt's rank depend on unrelated
 * prompts, so the same query would quietly reorder itself as the library grew.
 *
 * Dismissals damp standing rather than subtracting from it, so waving a
 * suggestion away several times can only ever pull it back toward neutral —
 * never below a prompt that has no history at all. And because the damped value
 * is itself recency-decayed, a prompt dismissed once a year ago is not punished
 * forever.
 *
 * What this deliberately cannot do: introduce a prompt. Candidates still have
 * to clear the similarity threshold first; standing only reorders what already
 * qualified. Nothing here is ever shown to the user — no score, no bar, no
 * ranking badge. A visible standing number would be prompt scoring wearing a
 * different hat, and that was cut on principle.
 */
export function suggestionRank(
  score: number,
  prompt: Pick<Prompt, 'usageCount' | 'lastUsedAt' | 'dismissCount'>,
  now: number,
): number {
  const damped = usefulnessScore(prompt, now) / (1 + Math.max(0, prompt.dismissCount ?? 0))
  const normalisedStanding = damped / (damped + STANDING_K)
  return SIMILARITY_WEIGHT * score + (1 - SIMILARITY_WEIGHT) * normalisedStanding
}
