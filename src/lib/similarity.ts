// Trigram-based similarity for the "you've been here before" feature.
// Cheap, local, zero-dependency. Upgrade to embeddings in a later version.

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

// The score that actually drives resurface. Plain Jaccard misfires on short
// prompts: when a brief query is nearly a substring of a much longer stored
// prompt, the union term (dominated by the long prompt) tanks the score even
// though the reuse is real. We blend symmetric Jaccard (precision anchor) with
// the overlap coefficient — intersection over the *smaller* set — which stays
// high for short-in-long matches. Identical strings still score 1; unrelated
// strings still score 0. This is the "handle short prompts explicitly" item.
export function similarity(a: string, b: string): number {
  const ga = trigramSet(a)
  const gb = trigramSet(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter++
  if (inter === 0) return 0
  const union = ga.size + gb.size - inter
  const jac = inter / union
  const overlap = inter / Math.min(ga.size, gb.size)
  return (jac + overlap) / 2
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
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
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

// Default threshold matches the live resurface path (background/index.ts).
export function findSimilar<T extends { text: string }>(
  query: string,
  pool: T[],
  threshold = 0.4,
  limit = 3,
): Array<SimilarResult<T>> {
  if (query.trim().length < 10) return []
  return pool
    .map((item) => ({
      item,
      score: similarity(query, item.text),
      terms: sharedTerms(query, item.text),
    }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
