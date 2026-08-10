import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startHealthProbe } from './health'

// The probe is what decides whether the in-page dot says "Deja can't see this
// box". Getting stuck in that state is worse than never showing it: the dot
// would be telling the person something untrue, and offering a hand-save they
// don't need, for the rest of the page's life.

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void

function installChrome() {
  const store: Record<string, unknown> = {}
  const listeners: Listener[] = []
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (patch: Record<string, unknown>) => {
          Object.assign(store, patch)
          for (const [k, v] of Object.entries(patch)) {
            for (const l of [...listeners]) l({ [k]: { newValue: v } }, 'local')
          }
        },
      },
      onChanged: {
        addListener: (l: Listener) => listeners.push(l),
        removeListener: (l: Listener) => {
          const i = listeners.indexOf(l)
          if (i >= 0) listeners.splice(i, 1)
        },
      },
    },
  } as unknown as typeof chrome
  return { store, listeners }
}

const health = (store: Record<string, unknown>) =>
  (store.captureHealth as Record<string, { ok: boolean }> | undefined)?.chatgpt

/** Let the probe's fire-and-forget storage writes settle. */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(0)
  await Promise.resolve()
}

describe('startHealthProbe', () => {
  let stop: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    stop?.()
    stop = null
    vi.useRealTimers()
    // @ts-expect-error test-only teardown of the global chrome mock
    delete globalThis.chrome
  })

  it('records that capture is working once it finds the composer', async () => {
    const { store } = installChrome()
    const el = document.createElement('textarea')
    stop = startHealthProbe(() => el, 'chatgpt')

    await vi.advanceTimersByTimeAsync(600)
    await settle()
    expect(health(store)?.ok).toBe(true)
  })

  it('recovers after the message pipeline fails, not just after selector drift', async () => {
    // This is the regression that matters. capture.ts marks a platform
    // unhealthy when its sendMessage fails, writing straight to storage and
    // bypassing the probe's own bookkeeping. If the probe doesn't notice, its
    // next recheck sees no transition, writes nothing, and the stored value
    // stays false forever — the dot stays amber even though capture is fine.
    const { store } = installChrome()
    const el = document.createElement('textarea')
    const seen: boolean[] = []
    stop = startHealthProbe(() => el, 'chatgpt', (ok) => seen.push(ok))

    await vi.advanceTimersByTimeAsync(600)
    await settle()
    expect(health(store)?.ok).toBe(true)

    // Stand in for capture.ts's failure write.
    await chrome.storage.local.set({
      captureHealth: { chatgpt: { ok: false, lastCheckedAt: Date.now(), lastHealthyAt: null } },
    })
    await settle()
    expect(health(store)?.ok).toBe(false)

    // The composer is still right there, so the next recheck must undo it.
    await vi.advanceTimersByTimeAsync(31_000)
    await settle()
    expect(health(store)?.ok).toBe(true)
    expect(seen).toContain(true)
  })

  it('reports unhealthy when the composer never turns up', async () => {
    const { store } = installChrome()
    stop = startHealthProbe(() => null, 'chatgpt')

    await vi.advanceTimersByTimeAsync(11_000)
    await settle()
    expect(health(store)?.ok).toBe(false)
  })

  it('stops touching storage once torn down', async () => {
    const { store } = installChrome()
    const el = document.createElement('textarea')
    const probe = startHealthProbe(() => el, 'chatgpt')
    await vi.advanceTimersByTimeAsync(600)
    await settle()
    probe()

    delete (store as Record<string, unknown>).captureHealth
    await vi.advanceTimersByTimeAsync(60_000)
    await settle()
    expect(store.captureHealth).toBeUndefined()
  })
})
