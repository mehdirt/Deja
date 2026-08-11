import { describe, expect, it } from 'vitest'
import { pickSpot, spotFor, type Spot } from './anchor'

// The dot has to look like it belongs to the message box. That means inside a
// corner — and never on top of whatever control the site already put there.

/** A message box roughly the shape of a real chat composer. */
const box = (): DOMRect =>
  ({ left: 100, top: 200, right: 700, bottom: 300, width: 600, height: 100, x: 100, y: 200 }) as DOMRect

const SIZE = 24
const GAP = 8
const free = () => false

describe('spotFor', () => {
  it('keeps every corner inside the box', () => {
    const rect = box()
    for (const corner of ['bottom-right', 'top-right', 'top-left'] as const) {
      const s = spotFor(rect, SIZE, GAP, corner)
      expect(s.left).toBeGreaterThanOrEqual(rect.left)
      expect(s.top).toBeGreaterThanOrEqual(rect.top)
      expect(s.left + SIZE).toBeLessThanOrEqual(rect.right)
      expect(s.top + SIZE).toBeLessThanOrEqual(rect.bottom)
    }
  })

  it('puts the last-resort spot outside, vertically centred', () => {
    const rect = box()
    const s = spotFor(rect, SIZE, GAP, 'outside-right')
    expect(s.left).toBeGreaterThan(rect.right)
    expect(s.top + SIZE / 2).toBeCloseTo(rect.top + rect.height / 2)
  })
})

describe('pickSpot', () => {
  it('prefers the bottom-right of the box when nothing is in the way', () => {
    expect(pickSpot(box(), SIZE, GAP, free).corner).toBe('bottom-right')
  })

  it("steps to the next corner when the site's own control is there", () => {
    // Stand in for a send button overlaying the bottom-right.
    const occupied = (s: Spot) => s.corner === 'bottom-right'
    expect(pickSpot(box(), SIZE, GAP, occupied).corner).toBe('top-right')
  })

  it('falls outside the box only when every corner is taken', () => {
    const occupied = (s: Spot) => s.corner !== 'outside-right'
    expect(pickSpot(box(), SIZE, GAP, occupied).corner).toBe('outside-right')
  })

  it('still returns somewhere when literally everything is occupied', () => {
    // A dot in an awkward place beats a dot that silently vanishes.
    const spot = pickSpot(box(), SIZE, GAP, () => true)
    expect(spot).toBeTruthy()
    expect(spot.corner).toBe('outside-right')
  })

  it('honours a per-site pin', () => {
    expect(pickSpot(box(), SIZE, GAP, free, 'top-left').corner).toBe('top-left')
  })

  it('never lets a pin park the dot on a control', () => {
    // A pin expresses a preference, not permission to overlap the site's UI.
    const occupied = (s: Spot) => s.corner === 'top-left'
    expect(pickSpot(box(), SIZE, GAP, occupied, 'top-left').corner).not.toBe('top-left')
  })
})
