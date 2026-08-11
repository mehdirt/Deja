import { describe, expect, it } from 'vitest'
import {
  OVERLAY_TOKENS,
  OVERLAY_BASE,
  brandFontFaces,
  createOverlayHost,
  isRealUserEvent,
} from './overlayTheme'

describe('createOverlayHost', () => {
  it('mounts a closed root the host page cannot reach into', () => {
    const layer = createOverlayHost('test', '')
    expect(layer.host.shadowRoot).toBeNull()
    expect(layer.shadow).toBeTruthy()
    layer.destroy()
  })

  it('puts the layer back after the host page detaches it', () => {
    const layer = createOverlayHost('test', '')
    expect(layer.host.isConnected).toBe(true)
    layer.host.remove()
    expect(layer.host.isConnected).toBe(false)
    layer.reattach()
    expect(layer.host.isConnected).toBe(true)
    layer.destroy()
  })

  it('never lets the layer swallow clicks meant for the page', () => {
    const layer = createOverlayHost('test', '')
    expect(layer.host.style.pointerEvents).toBe('none')
    layer.destroy()
  })

  it('defines the palette for both themes', () => {
    expect(OVERLAY_TOKENS).toContain('prefers-color-scheme: dark')
    expect(OVERLAY_TOKENS).toContain(':host{all:initial}')
  })

  it('styles the wordmark with the brand face stack', () => {
    expect(OVERLAY_BASE).toContain('.dj-wordmark')
    expect(OVERLAY_TOKENS).toContain("--dj-font-brand:'Literata'")
  })
})

describe('brandFontFaces', () => {
  it('is empty without an extension runtime (tests / orphaned scripts)', () => {
    // happy-dom has no chrome.runtime.id — Georgia fallback still applies.
    expect(brandFontFaces()).toBe('')
  })
})

describe('isRealUserEvent', () => {
  it('rejects an event a page script synthesised', () => {
    expect(isRealUserEvent(new Event('click'))).toBe(false)
  })
})
