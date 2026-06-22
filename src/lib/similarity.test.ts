import { describe, expect, it } from 'vitest'
import { jaccard, findSimilar } from './similarity'

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
})
