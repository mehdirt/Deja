import { describe, expect, it } from 'vitest'
import {
  LIBRARY_CAP_DEFAULT,
  LIBRARY_CAP_OFF,
  coerceLibraryCap,
  pickTrimIds,
} from './libraryCap'

function row(
  id: number,
  opts: { usage?: number; created?: number; pinned?: boolean; deleted?: boolean } = {},
) {
  return {
    id,
    usageCount: opts.usage ?? 0,
    createdAt: opts.created ?? id,
    pinned: opts.pinned ?? false,
    deletedAt: opts.deleted ? 1 : null,
  }
}

describe('coerceLibraryCap', () => {
  it('defaults when missing or invalid', () => {
    expect(coerceLibraryCap(undefined)).toBe(LIBRARY_CAP_DEFAULT)
    expect(coerceLibraryCap('nope')).toBe(LIBRARY_CAP_DEFAULT)
    expect(coerceLibraryCap(NaN)).toBe(LIBRARY_CAP_DEFAULT)
  })

  it('treats non-positive as off', () => {
    expect(coerceLibraryCap(0)).toBe(LIBRARY_CAP_OFF)
    expect(coerceLibraryCap(-3)).toBe(LIBRARY_CAP_OFF)
  })

  it('accepts known choices', () => {
    expect(coerceLibraryCap(2000)).toBe(2000)
    expect(coerceLibraryCap(5000)).toBe(5000)
    expect(coerceLibraryCap(10000)).toBe(10000)
  })
})

describe('pickTrimIds', () => {
  it('returns nothing when under or at the cap', () => {
    const rows = [row(1), row(2), row(3)]
    expect(pickTrimIds(rows, 3)).toEqual([])
    expect(pickTrimIds(rows, 10)).toEqual([])
    expect(pickTrimIds(rows, 0)).toEqual([])
  })

  it('drops lowest usage first, then oldest on a tie', () => {
    const rows = [
      row(1, { usage: 5, created: 100 }),
      row(2, { usage: 0, created: 200 }),
      row(3, { usage: 0, created: 50 }),
      row(4, { usage: 2, created: 10 }),
    ]
    // Live 4, cap 2 → trim 2: both usage-0, older (3) then (2)
    expect(pickTrimIds(rows, 2)).toEqual([3, 2])
  })

  it('never selects favorites', () => {
    const rows = [
      row(1, { usage: 0, pinned: true }),
      row(2, { usage: 0 }),
      row(3, { usage: 0 }),
    ]
    // Live 3, cap 1 → need 2 trims; only non-favorites (2, then 3 by age)
    expect(pickTrimIds(rows, 1)).toEqual([2, 3])
    expect(pickTrimIds(rows, 1)).not.toContain(1)
  })

  it('ignores already-deleted rows in the count', () => {
    const rows = [row(1), row(2, { deleted: true }), row(3), row(4)]
    // Live 3, cap 2 → trim 1 (lowest usage / oldest among live)
    expect(pickTrimIds(rows, 2)).toEqual([1])
  })

  it('stops when only favorites remain over the cap', () => {
    const rows = [
      row(1, { pinned: true }),
      row(2, { pinned: true }),
      row(3, { pinned: true }),
    ]
    expect(pickTrimIds(rows, 1)).toEqual([])
  })
})
