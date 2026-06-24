import { describe, expect, it } from 'vitest'
import {
  jaccard,
  similarity,
  sharedTerms,
  findSimilar,
  buildTrigramIdf,
  thresholdForLength,
} from './similarity'

describe('jaccard trigram similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccard('hello world', 'hello world')).toBeCloseTo(1)
  })

  it('returns higher score for closely related strings', () => {
    const close = jaccard('write a poem about cats', 'write a poem about dogs')
    const far = jaccard('write a poem about cats', 'fix this typescript bug')
    expect(close).toBeGreaterThan(far)
  })

  it('returns 0 for empty input', () => {
    expect(jaccard('', 'hello')).toBe(0)
  })
})

describe('similarity (resurface score)', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('hello world', 'hello world')).toBeCloseTo(1)
  })

  it('returns 0 when nothing overlaps', () => {
    expect(similarity('apples and oranges', 'fix the build pipeline')).toBe(0)
  })

  it('scores a short query nearly contained in a long prompt higher than plain Jaccard', () => {
    const long =
      'write a detailed bash script that backs up my postgres database every night and rotates old dumps'
    const short = 'backs up my postgres database'
    // Plain Jaccard tanks here because the union is dominated by the long
    // prompt; the blended score should rescue the short-in-long match.
    expect(similarity(short, long)).toBeGreaterThan(jaccard(short, long))
    expect(similarity(short, long)).toBeGreaterThan(0.4)
  })
})

describe('IDF weighting', () => {
  it('down-weighting the shared trigrams lowers the score', () => {
    const a = 'the cat sat'
    const b = 'the cat ran'
    const base = similarity(a, b)
    // A weight that treats trigrams containing "cat" (the shared signal) as
    // near-worthless should drag the score below the unweighted blend.
    const muted = similarity(a, b, (g) => (g.includes('cat') ? 0.01 : 1))
    expect(muted).toBeLessThan(base)
  })

  it('identical strings still score 1 under IDF weighting', () => {
    const idf = buildTrigramIdf(['deploy the service', 'write a poem', 'fix the bug'])
    expect(similarity('deploy the service', 'deploy the service', idf)).toBeCloseTo(1)
  })

  it('scores a distinctive-term match above a boilerplate-only match', () => {
    // "weekly report" is boilerplate (appears in many stored prompts → low IDF);
    // "kubernetes" is rare (→ high IDF). A query touching both should prefer the
    // candidate that shares the rare term over the one sharing only boilerplate.
    const boilerplate = Array.from(
      { length: 8 },
      (_, i) => `weekly report number ${i} for the team meeting`,
    )
    const distinctive = 'notes about kubernetes autoscaling behavior'
    const boilerOnly = 'weekly report on something unrelated entirely'
    const idf = buildTrigramIdf([distinctive, boilerOnly, ...boilerplate])

    const query = 'weekly report about kubernetes'
    expect(similarity(query, distinctive, idf)).toBeGreaterThan(
      similarity(query, boilerOnly, idf),
    )
  })

  it('keeps a genuinely similar long pair above the live 0.4 bar in a boilerplate-heavy pool', () => {
    // The scale-shift guard: as a heavy user's pool fills with structurally
    // similar prompts, IDF must not silently deflate a real partial match below
    // the threshold the live path uses. Long query (no short-query penalty).
    const variants = Array.from(
      { length: 40 },
      (_, i) => `write a detailed poem about my pet number ${i}`,
    )
    const target = { text: 'write a detailed poem about my three orange cats' }
    const pool = [target, ...variants.map((text) => ({ text }))]
    const query = 'write a detailed poem about my three orange dogs'
    const results = findSimilar(query, pool, 0.4)
    expect(results[0]?.item.text).toBe(target.text)
    expect(results[0]!.score).toBeGreaterThanOrEqual(0.4)
  })
})

describe('thresholdForLength', () => {
  it('leaves the base threshold untouched for long queries', () => {
    expect(thresholdForLength(100, 0.4)).toBeCloseTo(0.4)
  })

  it('raises the bar for short queries', () => {
    expect(thresholdForLength(12, 0.4)).toBeGreaterThan(0.4)
  })

  it('is monotonic — shorter queries never get an easier bar', () => {
    expect(thresholdForLength(15, 0.4)).toBeGreaterThanOrEqual(thresholdForLength(30, 0.4))
    expect(thresholdForLength(30, 0.4)).toBeGreaterThanOrEqual(thresholdForLength(45, 0.4))
  })
})

describe('sharedTerms', () => {
  it('returns the meaningful words two prompts share, skipping stopwords', () => {
    const terms = sharedTerms('write a poem about kittens', 'a short poem featuring kittens')
    expect(terms).toContain('poem')
    expect(terms).toContain('kittens')
    expect(terms).not.toContain('a')
    expect(terms).not.toContain('about')
  })

  it('caps the number of terms returned', () => {
    const terms = sharedTerms(
      'alpha bravo charlie delta echo',
      'alpha bravo charlie delta echo',
      3,
    )
    expect(terms).toHaveLength(3)
  })

  it('returns nothing when only stopwords overlap', () => {
    expect(sharedTerms('the cat', 'the dog')).toEqual([])
  })
})

describe('findSimilar', () => {
  it('ignores very short queries', () => {
    const pool = [{ text: 'write a story about robots' }]
    expect(findSimilar('hi', pool)).toEqual([])
  })

  it('finds matches above threshold sorted desc', () => {
    const pool = [
      { text: 'write a poem about cats' },
      { text: 'write a poem about dogs' },
      { text: 'debug a typescript compile error' },
    ]
    const results = findSimilar('write a poem about kittens', pool, 0.2)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].item.text).toContain('poem')
  })

  it('attaches the shared terms to each result', () => {
    const pool = [{ text: 'write a poem about cats' }]
    const results = findSimilar('write a poem about kittens', pool, 0.2)
    expect(results[0].terms).toContain('poem')
  })

  it('respects the limit, returning the best candidates first', () => {
    const pool = [
      { text: 'write a poem about cats' },
      { text: 'write a poem about dogs' },
      { text: 'write a poem about birds' },
      { text: 'write a poem about fish' },
    ]
    const results = findSimilar('write a poem about kittens', pool, 0.2, 2)
    expect(results).toHaveLength(2)
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
  })
})
