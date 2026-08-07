import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, type Prefs } from '@/lib/prefs'
import { shouldCapture, startCaptureGate } from './captureGate'

// captureGate reads chrome.storage.local through prefs.ts. There's no global
// chrome mock in this repo's test setup, so each test installs a minimal one
// covering exactly what readPrefs/onPrefsChange touch.
function installChrome(prefs: Partial<Prefs>, incognito = false) {
  const stored = { ...DEFAULT_PREFS, ...prefs }
  globalThis.chrome = {
    storage: {
      local: { get: async () => ({ prefs: stored }) },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
    extension: { inIncognitoContext: incognito },
  } as unknown as typeof chrome
}

afterEach(() => {
  // @ts-expect-error test-only teardown of the global chrome mock
  delete globalThis.chrome
})

describe('captureGate.shouldCapture', () => {
  it('allows capture by default (no pause, no site switch, not incognito)', async () => {
    installChrome({})
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(true)
  })

  it('refuses when the current site is switched off', async () => {
    installChrome({ sites: { ...DEFAULT_PREFS.sites, chatgpt: false } })
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(false)
  })

  it('does not refuse a DIFFERENT site switched off', async () => {
    installChrome({ sites: { ...DEFAULT_PREFS.sites, claude: false } })
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(true)
  })

  it('refuses while a timed pause is active', async () => {
    installChrome({ pauseUntil: Date.now() + 60_000 })
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(false)
  })

  it('allows again once a timed pause has expired', async () => {
    installChrome({ pauseUntil: Date.now() - 1 })
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(true)
  })

  it('fail-closed: refuses in an incognito window when autoPauseIncognito is on', async () => {
    installChrome({ autoPauseIncognito: true }, true)
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(false)
  })

  it('allows in incognito when the user disabled autoPauseIncognito', async () => {
    installChrome({ autoPauseIncognito: false }, true)
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(true)
  })

  it('fails open when chrome.storage is unavailable', async () => {
    // @ts-expect-error simulate an orphaned/unavailable extension context
    globalThis.chrome = undefined
    const gate = startCaptureGate('chatgpt')
    await gate.ready
    expect(shouldCapture()).toBe(true)
  })
})
