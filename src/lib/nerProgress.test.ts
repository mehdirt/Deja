import { describe, expect, it, vi } from 'vitest'
import { createNerProgressTracker, NER_DOWNLOAD_BYTE_HINT } from './nerProgress'

describe('createNerProgressTracker', () => {
  it('fills from loaded/total when Content-Length is present', () => {
    const emit = vi.fn()
    const onProgress = createNerProgressTracker(emit, { minDelta: 0, minMs: 0 })

    onProgress({ status: 'initiate', file: 'model.onnx' })
    onProgress({
      status: 'progress',
      file: 'model.onnx',
      loaded: 25,
      total: 100,
      progress: 25,
    })
    onProgress({
      status: 'progress',
      file: 'model.onnx',
      loaded: 50,
      total: 100,
      progress: 50,
    })

    expect(emit).toHaveBeenCalled()
    const last = emit.mock.calls.at(-1)?.[0] as number
    expect(last).toBeCloseTo(0.5, 2)
  })

  it('still advances when Content-Length is missing (loaded===total every tick)', () => {
    const emit = vi.fn()
    const onProgress = createNerProgressTracker(emit, {
      minDelta: 0,
      minMs: 0,
      byteHint: NER_DOWNLOAD_BYTE_HINT,
    })

    onProgress({ status: 'initiate', file: 'model.onnx' })
    onProgress({
      status: 'progress',
      file: 'model.onnx',
      loaded: 10_000_000,
      total: 10_000_000,
      progress: 100,
    })
    const mid = emit.mock.calls.at(-1)?.[0] as number
    onProgress({
      status: 'progress',
      file: 'model.onnx',
      loaded: 55_000_000,
      total: 55_000_000,
      progress: 100,
    })
    const later = emit.mock.calls.at(-1)?.[0] as number

    expect(mid).toBeGreaterThan(0.05)
    expect(later).toBeGreaterThan(mid)
    expect(later).toBeLessThan(0.99)
  })

  it('keeps moving across multiple files with mixed known lengths', () => {
    const emit = vi.fn()
    const onProgress = createNerProgressTracker(emit, { minDelta: 0, minMs: 0 })

    onProgress({ status: 'initiate', file: 'a.json' })
    onProgress({
      status: 'progress',
      file: 'a.json',
      loaded: 50,
      total: 100,
      progress: 50,
    })
    onProgress({ status: 'done', file: 'a.json' })
    onProgress({ status: 'initiate', file: 'b.onnx' })
    onProgress({
      status: 'progress',
      file: 'b.onnx',
      loaded: 25,
      total: 100,
      progress: 25,
    })

    const last = emit.mock.calls.at(-1)?.[0] as number
    // a done (100) + b 25/100 → 125/200 = 0.625
    expect(last).toBeCloseTo(0.625, 2)
  })
})
