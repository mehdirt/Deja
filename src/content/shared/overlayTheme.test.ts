import { describe, expect, it } from 'vitest'
import { OVERLAY_TOKENS, createOverlayHost, isRealUserEvent } from './overlayTheme'

// These two are security invariants, not styling details: a closed root is what
// stops a host page reading the library rows we render, and isTrusted is what
// stops it driving the surfaces that show them. Both are one keyword each, and
// a refactor could drop either without any other test noticing.

describe('createOverlayHost', () => {
  it('mounts a closed root the host page cannot reach into', () => {
    const layer = createOverlayHost('test', '')
    // The observable consequence of mode:'closed' — a page script that finds
    // our element still gets nothing from it.
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
    // Declared on :host, which is what lets them cascade past all:initial.
    expect(OVERLAY_TOKENS).toContain(':host{all:initial}')
  })
})

describe('isRealUserEvent', () => {
  it('rejects an event a page script synthesised', () => {
    // dispatchEvent() cannot forge isTrusted — this is the whole gate.
    expect(isRealUserEvent(new Event('click'))).toBe(false)
  })
})
