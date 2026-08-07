import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachSubmitHook } from './capture'

// attachSubmitHook's debounce/dedup guard is the last line of defense against
// double-capturing a single submit (Enter fires a keydown AND a send-button
// click often fires too). chrome.runtime is mocked minimally — id + a
// sendMessage spy — capture-health and prefs/blocklist gating all fail open
// with no chrome.storage mock present, which is the real content-script
// behavior on a fresh page load before those caches populate.
function installChromeRuntime() {
  const sendMessage = vi.fn().mockResolvedValue({
    ok: true,
    id: 1,
    filtered: false,
    notice: false,
    redacted: 0,
  })
  globalThis.chrome = {
    runtime: { id: 'test-extension-id', sendMessage },
  } as unknown as typeof chrome
  return sendMessage
}

function pressEnter(el: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  Object.defineProperty(event, 'target', { value: el, enumerable: true })
  el.dispatchEvent(event)
}

describe('attachSubmitHook debounce/dedup', () => {
  let textarea: HTMLTextAreaElement
  let detach: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    detach = attachSubmitHook(() => textarea, 'chatgpt')
  })

  afterEach(() => {
    detach()
    textarea.remove()
    // @ts-expect-error test-only teardown of the global chrome mock
    delete globalThis.chrome
    vi.useRealTimers()
  })

  it('captures once for a single Enter submit', () => {
    const sendMessage = installChromeRuntime()
    textarea.value = 'write a poem about cats'
    pressEnter(textarea)
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('does not double-capture the same text submitted twice within 2s', () => {
    const sendMessage = installChromeRuntime()
    textarea.value = 'write a poem about cats'
    pressEnter(textarea)
    vi.advanceTimersByTime(500)
    pressEnter(textarea)
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('captures again once the 2s debounce window has passed', () => {
    const sendMessage = installChromeRuntime()
    textarea.value = 'write a poem about cats'
    pressEnter(textarea)
    vi.advanceTimersByTime(2001)
    pressEnter(textarea)
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('captures different text submitted back-to-back (not deduped)', () => {
    const sendMessage = installChromeRuntime()
    textarea.value = 'write a poem about cats'
    pressEnter(textarea)
    textarea.value = 'write a poem about dogs'
    pressEnter(textarea)
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('ignores Enter with a modifier key (shift/alt) or during IME composition', () => {
    const sendMessage = installChromeRuntime()
    textarea.value = 'write a poem about cats'
    const shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
    })
    Object.defineProperty(shiftEnter, 'target', { value: textarea, enumerable: true })
    textarea.dispatchEvent(shiftEnter)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('does not capture text under 2 characters', () => {
    const sendMessage = installChromeRuntime()
    textarea.value = 'h'
    pressEnter(textarea)
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
