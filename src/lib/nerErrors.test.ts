import { describe, expect, it } from 'vitest'
import { scrubNerErrorDetail, toSafeNerError } from './nerErrors'

describe('scrubNerErrorDetail', () => {
  it('strips signed CDN urls and extension ids', () => {
    const scrubbed = scrubNerErrorDetail(
      'Failed to fetch https://us.aws.cdn.hf.co/xet/abc?Signature=SECRET&Policy=eyJ and chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/onnx/x.mjs',
    )
    expect(scrubbed).not.toMatch(/Signature=SECRET/)
    expect(scrubbed).not.toMatch(/abcdefghijklmnopqrstuvwxyzabcdef/)
    expect(scrubbed).toContain('https://us.aws.cdn.hf.co/…')
    expect(scrubbed).toContain('chrome-extension://…')
  })

  it('redacts token-shaped substrings', () => {
    expect(scrubNerErrorDetail('token hf_AbCdEfGhIjKlMnOp')).not.toMatch(/hf_AbCd/)
  })
})

describe('toSafeNerError', () => {
  it('never returns the raw exception as the primary message', () => {
    const safe = toSafeNerError(
      new Error('Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/evil.mjs?tok=1'),
    )
    expect(safe.message).not.toMatch(/jsdelivr|tok=1|dynamically imported/i)
    expect(safe.kind).toBe('setup')
  })

  it('maps network failures', () => {
    expect(toSafeNerError(new Error('Failed to fetch')).kind).toBe('network')
    expect(toSafeNerError(new Error('network error')).kind).toBe('network')
  })

  it('omits useless bare network-error detail', () => {
    expect(toSafeNerError(new Error('network error')).detail).toBeUndefined()
    expect(toSafeNerError(new Error('Couldn’t download onnx/model_quantized.onnx: boom')).detail).toMatch(
      /model_quantized/,
    )
  })
})
