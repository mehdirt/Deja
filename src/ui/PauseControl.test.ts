import { describe, expect, it } from 'vitest'
import { PAUSE_FOREVER } from '@/lib/prefs'
import { remainingLabel } from './PauseControl'

describe('remainingLabel', () => {
  it('reads as indefinite for PAUSE_FOREVER regardless of now', () => {
    expect(remainingLabel(PAUSE_FOREVER, Date.now())).toBe('until you turn it back on')
  })

  it('returns empty once the pause has already elapsed', () => {
    expect(remainingLabel(1000, 1000)).toBe('')
    expect(remainingLabel(1000, 2000)).toBe('')
  })

  it('says "less than a minute left" under the 1-minute boundary', () => {
    expect(remainingLabel(1000 + 59_000, 1000)).toBe('less than a minute left')
  })

  it('pluralizes minutes below the 1-hour boundary', () => {
    expect(remainingLabel(1000 + 5 * 60_000, 1000)).toBe('5 min left')
  })

  it('switches to hour formatting at the 60-minute boundary', () => {
    expect(remainingLabel(1000 + 60 * 60_000, 1000)).toBe('1h left')
  })

  it('shows both hours and minutes when the remainder is non-zero', () => {
    expect(remainingLabel(1000 + 90 * 60_000, 1000)).toBe('1h 30m left')
  })

  it('omits the minutes segment when the remainder is exactly zero', () => {
    expect(remainingLabel(1000 + 120 * 60_000, 1000)).toBe('2h left')
  })
})
