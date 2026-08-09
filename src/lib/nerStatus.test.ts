import { describe, expect, it } from 'vitest'
import { DEFAULT_NER_STATUS, mergeNerStatusUi, type NerStatus } from './nerStatus'

function downloading(progress: number): NerStatus {
  return { ...DEFAULT_NER_STATUS, state: 'downloading', progress }
}

describe('mergeNerStatusUi', () => {
  it('keeps peak progress while downloading', () => {
    const prev = downloading(0.42)
    const next = downloading(0)
    expect(mergeNerStatusUi(prev, next).progress).toBe(0.42)
    expect(mergeNerStatusUi(prev, downloading(0.55)).progress).toBe(0.55)
  })

  it('allows intentional reset to 0%', () => {
    const prev = downloading(0.42)
    expect(mergeNerStatusUi(prev, downloading(0), { reset: true }).progress).toBe(0)
  })

  it('accepts ready / error without clamping', () => {
    const prev = downloading(0.8)
    expect(mergeNerStatusUi(prev, { ...DEFAULT_NER_STATUS, state: 'ready', progress: 1 }).state).toBe(
      'ready',
    )
    expect(
      mergeNerStatusUi(prev, {
        ...DEFAULT_NER_STATUS,
        state: 'error',
        progress: 0,
        error: 'Nope',
      }).state,
    ).toBe('error')
  })
})
