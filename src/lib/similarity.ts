// Trigram-based similarity for the "you've been here before" feature.
// Cheap, local, zero-dependency. Upgrade to embeddings in a later version.

function trigrams(s: string): Set<string> {
  const t = ` ${s.toLowerCase().replace(/\s+/g, ' ').trim()} `
  const grams = new Set<string>()
  for (let i = 0; i <= t.length - 3; i++) grams.add(t.slice(i, i + 3))
  return grams
}

export function jaccard(a: string, b: string): number {
  const ga = trigrams(a)
  const gb = trigrams(b)
  if (ga.size === 0 || gb.size === 0) return 0
  let inter = 0
  for (const g of ga) if (gb.has(g)) inter++
  return inter / (ga.size + gb.size - inter)
}

export function findSimilar<T extends { text: string }>(
  query: string,
  pool: T[],
  threshold = 0.35,
  limit = 3,
): Array<{ item: T; score: number }> {
  if (query.trim().length < 10) return []
  const scored = pool
    .map((item) => ({ item, score: jaccard(query, item.text) }))
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}
