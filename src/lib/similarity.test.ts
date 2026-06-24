import { describe, expect, it } from 'vitest'
import { jaccard, similarity, sharedTerms, findSimilar } from './similarity'

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
