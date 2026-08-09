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

  it('uses the progress field when loaded/total are missing', () => {
    const emit = vi.fn()
    const onProgress = createNerProgressTracker(emit, { minDelta: 0, minMs: 0 })

    onProgress({ status: 'initiate', file: 'model.onnx' })
    onProgress({ status: 'progress', file: 'model.onnx', progress: 40 })
    onProgress({ status: 'progress', file: 'model.onnx', progress: 70 })

    const last = emit.mock.calls.at(-1)?.[0] as number
    expect(last).toBeCloseTo(0.7, 2)
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
})
