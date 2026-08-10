import { describe, expect, it } from 'vitest'
import { suggestionRank, usefulnessScore } from './ranking'

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
    const score = usefulnessScore(
      { usageCount: undefined as unknown as number, lastUsedAt: undefined as unknown as number },
      now,
    )
    expect(Number.isFinite(score)).toBe(true)
    expect(score).toBeGreaterThanOrEqual(0)
  })
})

describe('suggestionRank', () => {
  const NOW = Date.UTC(2026, 7, 10)
  const day = 24 * 60 * 60 * 1000

  it('keeps similarity dominant — standing breaks ties, it does not decide them', () => {
    // A much closer match beats a heavily-used but distant one.
    const closeUnused = suggestionRank(0.9, { usageCount: 0, lastUsedAt: NOW }, NOW)
    const farFavourite = suggestionRank(0.5, { usageCount: 200, lastUsedAt: NOW }, NOW)
    expect(closeUnused).toBeGreaterThan(farFavourite)
  })

  it('promotes a prompt you actually reuse over a marginally closer one', () => {
    const neverUsed = suggestionRank(0.62, { usageCount: 0, lastUsedAt: NOW - 200 * day }, NOW)
    const reused = suggestionRank(0.6, { usageCount: 8, lastUsedAt: NOW }, NOW)
    expect(reused).toBeGreaterThan(neverUsed)
  })

  it('never lets standing run away, however heavily a prompt is used', () => {
    // The bonus is bounded, so the gap between "used once" and "used forever"
    // can never exceed the weight we gave standing.
    const once = suggestionRank(0.5, { usageCount: 1, lastUsedAt: NOW }, NOW)
    const constant = suggestionRank(0.5, { usageCount: 10_000, lastUsedAt: NOW }, NOW)
    expect(constant - once).toBeLessThan(0.2)
    expect(constant).toBeLessThan(0.5 * 0.8 + 0.2)
  })

  it('lowers a prompt that keeps being waved away', () => {
    const base = { usageCount: 5, lastUsedAt: NOW }
    const kept = suggestionRank(0.6, base, NOW)
    const dismissed = suggestionRank(0.6, { ...base, dismissCount: 6 }, NOW)
    expect(dismissed).toBeLessThan(kept)
  })

  it('damps dismissals rather than punishing — never below a prompt with no history', () => {
    const dismissedALot = suggestionRank(0.6, { usageCount: 3, lastUsedAt: NOW, dismissCount: 99 }, NOW)
    const noHistory = suggestionRank(0.6, { usageCount: 0, lastUsedAt: 0 }, NOW)
    expect(dismissedALot).toBeGreaterThanOrEqual(noHistory)
  })

  it('forgets an old dismissal, because standing itself decays', () => {
    const longAgo = { usageCount: 4, lastUsedAt: NOW - 365 * day, dismissCount: 10 }
    const fresh = { usageCount: 4, lastUsedAt: NOW, dismissCount: 10 }
    expect(suggestionRank(0.6, fresh, NOW)).toBeGreaterThan(suggestionRank(0.6, longAgo, NOW))
  })
})
