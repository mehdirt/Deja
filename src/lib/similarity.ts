// Trigram-based similarity for the "you've been here before" feature.
// Cheap, local, zero-dependency. Upgrade to embeddings in a later version.

// ── Tuning knobs ─────────────────────────────────────────────────────────────
// These are PROVISIONAL. The mechanisms below (IDF weighting, length-aware
// threshold) are the real work; the exact numbers should be tuned from watching
// real users, not guessed harder. They're centralized here so tuning is a
// one-line change once we have reaction data.
const MIN_QUERY_LEN = 10 // below this we don't even try — too little signal
const FULL_CONTEXT_LEN = 40 // at/above this length, no short-query penalty
const SHORT_QUERY_PENALTY = 0.15 // most we add to the threshold for the shortest queries
// How hard IDF bends the score. Full IDF (1.0) is pool-dependent enough to drift
// the whole score scale — in a pool full of structurally-similar prompts (the
// heavy user the feature is FOR), shared phrasing becomes "boilerplate" with low
// weight and genuine partial matches can sink below the fixed threshold. Raising
// IDF to this power (<1) keeps the *ranking* benefit (distinctive terms still win)
// while damping the scale shift, so the threshold keeps roughly its prior meaning.
const IDF_STRENGTH = 0.5

function trigramSet(s: string): Set<string> {
  const t = ` ${s.toLowerCase().replace(/\s+/g, ' ').trim()} `
  const grams = new Set<string>()
  for (let i = 0; i <= t.length - 3; i++) grams.add(t.slice(i, i + 3))
  return grams
}

export function jaccard(a: string, b: string): number {
  const ga = trigramSet(a)
  const gb = trigramSet(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter++
  return inter / (ga.size + gb.size - inter)
}

// A per-trigram weight. The default treats every trigram equally; findSimilar
// supplies an IDF weighting computed from the pool so distinctive trigrams
// (e.g. "kub" in "kubernetes") count more than boilerplate ("the", "ing").
export type TrigramWeight = (trigram: string) => number
const UNIT_WEIGHT: TrigramWeight = () => 1

function totalWeight(grams: Set<string>, weight: TrigramWeight): number {
  let sum = 0
  for (const g of grams) sum += weight(g)
  return sum
}

// The core blended score over two pre-computed trigram sets. Blends symmetric
// (weighted) Jaccard — the precision anchor — with the overlap coefficient,
// which divides by the *smaller* set's weight so a short query nearly contained
// in a longer stored prompt still scores (plain Jaccard's union term tanked
// those short-in-long matches). With UNIT_WEIGHT this reduces to a pure
// trigram-count blend; with IDF weights, shared rare trigrams dominate.
function blendedScore(
  ga: Set<string>,
  wa: number,
  gb: Set<string>,
  weight: TrigramWeight,
): number {
  if (ga.size === 0 || gb.size === 0) return 0
  let interW = 0
  for (const g of ga) if (gb.has(g)) interW += weight(g)
  if (interW === 0) return 0
  const wb = totalWeight(gb, weight)
  const jac = interW / (wa + wb - interW)
  const overlap = interW / Math.min(wa, wb)
  return (jac + overlap) / 2
}

// The score that drives resurface, comparing two strings directly. Pass a
// `weight` to bias toward distinctive trigrams; omit it for an unweighted blend.
// Identical strings score 1; strings sharing no trigrams score 0; always [0,1].
export function similarity(a: string, b: string, weight: TrigramWeight = UNIT_WEIGHT): number {
  const ga = trigramSet(a)
  const gb = trigramSet(b)
  return blendedScore(ga, totalWeight(ga, weight), gb, weight)
}

// Turn document-frequency counts into a damped IDF weight. Smoothed so it never
// divides by zero; the result is always ≥ 1 (a trigram in every doc → weight 1),
// so query-only trigrams (df 0) get the maximum weight — they're maximally rare.
function idfFromDf(df: Map<string, number>, n: number): TrigramWeight {
  return (g) => (Math.log((n + 1) / ((df.get(g) ?? 0) + 1)) + 1) ** IDF_STRENGTH
}

function documentFrequencies(grams: Array<Set<string>>): Map<string, number> {
  const df = new Map<string, number>()
  for (const set of grams) {
    for (const g of set) df.set(g, (df.get(g) ?? 0) + 1)
  }
  return df
}

// Build an IDF weighting from a pool of texts: a trigram appearing in many
// stored prompts is common (low weight); one appearing in few is distinctive
// (high weight).
export function buildTrigramIdf(texts: string[]): TrigramWeight {
  return idfFromDf(documentFrequencies(texts.map(trigramSet)), texts.length)
}

// Short queries are ambiguous, so they need a stronger match to clear the bar.
// The threshold ramps from `base` (at FULL_CONTEXT_LEN+) up to base + penalty
// (at MIN_QUERY_LEN). Exported so the behavior is unit-testable without leaning
// on the exact constants.
export function thresholdForLength(queryLength: number, base: number): number {
  if (queryLength >= FULL_CONTEXT_LEN) return base
  const span = FULL_CONTEXT_LEN - MIN_QUERY_LEN
  const shortness = Math.min(1, Math.max(0, (FULL_CONTEXT_LEN - queryLength) / span))
  return base + SHORT_QUERY_PENALTY * shortness
}

// Common function words carry no signal about *why* two prompts match, so we
// drop them from the "matched on …" hint. Intentionally small — we'd rather
// show a slightly generic word than hide a meaningful one.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'as', 'at', 'by', 'it', 'this', 'that',
  'these', 'those', 'my', 'me', 'your', 'you', 'i', 'we', 'they', 'how', 'what',
  'why', 'when', 'can', 'could', 'would', 'should', 'please', 'about', 'into',
  'from', 'so', 'if', 'then', 'than', 'do', 'does', 'did',
])

function contentWords(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w),
  )
}

// The handful of meaningful words the query and a candidate share, in the
// candidate's order, deduped — used to show the user *why* a prompt resurfaced.
export function sharedTerms(query: string, candidate: string, limit = 3): string[] {
  const inQuery = new Set(contentWords(query))
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of contentWords(candidate)) {
    if (inQuery.has(w) && !seen.has(w)) {
      seen.add(w)
      out.push(w)
      if (out.length >= limit) break
    }
  }
  return out
}

export interface SimilarResult<T> {
  item: T
  score: number
  terms: string[]
}

// `threshold` is the BASE bar for a full-length query; short queries are held to
// a higher effective bar (see thresholdForLength). Default base matches the live
// resurface path (background/index.ts).
export function findSimilar<T extends { text: string }>(
  query: string,
  pool: T[],
  threshold = 0.4,
  limit = 3,
): Array<SimilarResult<T>> {
  const q = query.trim()
  if (q.length < MIN_QUERY_LEN) return []

  const queryGrams = trigramSet(q)
  if (queryGrams.size === 0) return []

  // Pre-compute each candidate's trigram set once (we need them for both the
  // IDF document-frequency counts and the per-candidate scoring).
  const candGrams = pool.map((p) => trigramSet(p.text))
  const weight = idfFromDf(documentFrequencies(candGrams), pool.length)

  const queryWeight = totalWeight(queryGrams, weight)
  const minScore = thresholdForLength(q.length, threshold)

  return pool
    .map((item, i) => ({
      item,
      score: blendedScore(queryGrams, queryWeight, candGrams[i], weight),
      terms: sharedTerms(q, item.text),
    }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
