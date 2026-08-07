import { afterEach, describe, expect, it } from 'vitest'
import { readHealth, writeHealth, type CaptureHealth } from './health'

function installChromeStorage(initial: Record<string, unknown> = {}) {
  const store = { ...initial }
  return {
    store,
    install() {
      globalThis.chrome = {
        storage: {
          local: {
            get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
            set: async (patch: Record<string, unknown>) => {
              Object.assign(store, patch)
            },
          },
        },
      } as unknown as typeof chrome
    },
  }
}

afterEach(() => {
  // @ts-expect-error test-only teardown of the global chrome mock
  delete globalThis.chrome
})

describe('readHealth', () => {
  it('returns an empty object when nothing is stored', async () => {
    installChromeStorage().install()
    expect(await readHealth()).toEqual({})
  })

  it('fails open (empty object) when storage throws', async () => {
    globalThis.chrome = {
      storage: { local: { get: async () => { throw new Error('boom') } } },
    } as unknown as typeof chrome
    expect(await readHealth()).toEqual({})
  })
})

describe('writeHealth', () => {
  it('records the platform as healthy with a lastHealthyAt stamp', async () => {
    const { store, install } = installChromeStorage()
    install()
    await writeHealth('chatgpt', true, 1000)
    const health = store.captureHealth as CaptureHealth
    expect(health.chatgpt).toEqual({ ok: true, lastCheckedAt: 1000, lastHealthyAt: 1000 })
  })

  it('marking unhealthy after a prior healthy check preserves lastHealthyAt', async () => {
    const { store, install } = installChromeStorage()
    install()
    await writeHealth('chatgpt', true, 1000)
    await writeHealth('chatgpt', false, 2000)
    const health = store.captureHealth as CaptureHealth
    expect(health.chatgpt).toEqual({ ok: false, lastCheckedAt: 2000, lastHealthyAt: 1000 })
  })

  it('marking unhealthy with no prior healthy check leaves lastHealthyAt null', async () => {
    const { store, install } = installChromeStorage()
    install()
    await writeHealth('chatgpt', false, 1000)
    const health = store.captureHealth as CaptureHealth
    expect(health.chatgpt).toEqual({ ok: false, lastCheckedAt: 1000, lastHealthyAt: null })
  })

  it('does not touch other platforms already recorded', async () => {
    const { store, install } = installChromeStorage({
      captureHealth: { claude: { ok: true, lastCheckedAt: 500, lastHealthyAt: 500 } },
    })
    install()
    await writeHealth('chatgpt', true, 1000)
    const health = store.captureHealth as CaptureHealth
    expect(health.claude).toEqual({ ok: true, lastCheckedAt: 500, lastHealthyAt: 500 })
    expect(health.chatgpt).toEqual({ ok: true, lastCheckedAt: 1000, lastHealthyAt: 1000 })
  })

  it('never throws when storage is unavailable', async () => {
    globalThis.chrome = {
      storage: {
        local: {
          get: async () => { throw new Error('boom') },
          set: async () => { throw new Error('boom') },
        },
      },
    } as unknown as typeof chrome
    await expect(writeHealth('chatgpt', true)).resolves.toBeUndefined()
  })
})
