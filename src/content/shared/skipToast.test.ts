import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A skip is permanent: nothing is written, so unlike a normal capture there is
// no row to go back for later. These tests pin which skip offers the decision
// back and which stays quiet — the difference is the whole point, so it should
// fail loudly if someone wires both the same way.
//
// The toast renders into a CLOSED shadow root (deliberately — see
// overlayTheme.ts), so there is no DOM to assert against. We check the wiring
// instead: which toast was asked for, and what its button actually does.

const showActionToast = vi.fn()
const showInfoToast = vi.fn()
const showSavedToast = vi.fn()

vi.mock('./toast', () => ({
  showActionToast: (...a: unknown[]) => showActionToast(...a),
  showInfoToast: (...a: unknown[]) => showInfoToast(...a),
  showSavedToast: (...a: unknown[]) => showSavedToast(...a),
}))

const { attachSubmitHook } = await import('./capture')

function installChrome(response: Record<string, unknown>) {
  const sendMessage = vi.fn().mockResolvedValue(response)
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

describe('overruling a skip', () => {
  let textarea: HTMLTextAreaElement
  let detach: () => void

  beforeEach(() => {
    showActionToast.mockReset()
    showInfoToast.mockReset()
    showSavedToast.mockReset()
    textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    detach = attachSubmitHook(() => textarea, 'chatgpt')
  })

  afterEach(() => {
    detach()
    textarea.remove()
    // @ts-expect-error test-only teardown of the global chrome mock
    delete globalThis.chrome
  })

  it("offers a 'short' skip back, and keeping it hand-saves the prompt", async () => {
    const sendMessage = installChrome({ ok: true, filtered: true, notice: false, reason: 'short' })
    textarea.value = 'draft the email'
    pressEnter(textarea)
    await vi.waitFor(() => expect(showActionToast).toHaveBeenCalled())

    const [, buttonLabel, onKeep] = showActionToast.mock.calls[0]
    expect(buttonLabel).toBe('Keep it')

    // Nothing is stored until the person says so.
    expect(sendMessage).toHaveBeenCalledTimes(1)
    ;(onKeep as () => void)()
    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'SAVE_MANUAL',
      text: 'draft the email',
      platform: 'chatgpt',
      url: expect.any(String),
    })
  })

  it('stays quiet for glue, offering nothing back', async () => {
    const sendMessage = installChrome({
      ok: true,
      filtered: true,
      notice: true,
      reason: 'trivial',
    })
    textarea.value = 'ok thanks'
    pressEnter(textarea)
    await vi.waitFor(() => expect(showInfoToast).toHaveBeenCalled())
    // Explained once, never offered back — being asked whether to keep "yes"
    // on every message would be worse than the skip itself.
    expect(showActionToast).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('says nothing at all once the glue explanation has been seen', async () => {
    installChrome({ ok: true, filtered: true, notice: false, reason: 'trivial' })
    textarea.value = 'ok thanks'
    pressEnter(textarea)
    await vi.waitFor(() => expect(showSavedToast).not.toHaveBeenCalled())
    expect(showInfoToast).not.toHaveBeenCalled()
    expect(showActionToast).not.toHaveBeenCalled()
  })

  it('still shows the normal saved toast when nothing was skipped', async () => {
    installChrome({ ok: true, id: 4, filtered: false, notice: false, redacted: 0 })
    textarea.value = 'plan three days of dinners'
    pressEnter(textarea)
    await vi.waitFor(() => expect(showSavedToast).toHaveBeenCalled())
    expect(showActionToast).not.toHaveBeenCalled()
  })
})
