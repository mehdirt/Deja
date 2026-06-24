import { describe, expect, it } from 'vitest'
import { usefulnessScore } from './ranking'

const DAY = 24 * 60 * 60 * 1000

describe('usefulnessScore', () => {
  const now = 1_700_000_000_000

  it('ranks a used prompt above a never-used one, all else equal', () => {
    const used = usefulnessScore({ usageCount: 5, lastUsedAt: now }, now)
    const unused = usefulnessScore({ usageCount: 0, lastUsedAt: now }, now)
    expect(used).toBeGreaterThan(unused)
  })

  it('breaks ties on recency when usage is equal', () => {
    const recent = usefulnessScore({ usageCount: 3, lastUsedAt: now - DAY }, now)
    const stale = usefulnessScore({ usageCount: 3, lastUsedAt: now - 60 * DAY }, now)
    expect(recent).toBeGreaterThan(stale)
  })

  it('gives a never-used-but-recent prompt a sensible, nonzero score', () => {
    const freshUnused = usefulnessScore({ usageCount: 0, lastUsedAt: now }, now)
    expect(freshUnused).toBeGreaterThan(0)
    // It should still rank below a comparably-recent prompt that has been used.
    const freshUsed = usefulnessScore({ usageCount: 2, lastUsedAt: now }, now)
    expect(freshUnused).toBeLessThan(freshUsed)
  })

  it('lets heavy usage outweigh a moderately staler prompt', () => {
    const heavyOld = usefulnessScore({ usageCount: 20, lastUsedAt: now - 7 * DAY }, now)
    const lightNew = usefulnessScore({ usageCount: 1, lastUsedAt: now }, now)
    expect(heavyOld).toBeGreaterThan(lightNew)
  })

  it('treats undefined usageCount/lastUsedAt as 0 without throwing', () => {
    const score = usefulnessScore({ usageCount: undefined as unknown as number, lastUsedAt: undefined as unknown as number }, now)
    expect(Number.isFinite(score)).toBe(true)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})
