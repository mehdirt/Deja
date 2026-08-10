import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFS,
  PAUSE_FOREVER,
  isPaused,
  readPrefs,
  writePrefs,
  type Prefs,
} from './prefs'

// prefs.ts talks to chrome.storage.local. There's no global chrome mock in
// this repo's test setup, so each test installs a minimal in-memory one.
function installChromeStorage(initial: Record<string, unknown> = {}) {
  const store = { ...initial }
  const listeners: Array<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void> = []
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (patch: Record<string, unknown>) => {
          const before = { ...store }
          Object.assign(store, patch)
          for (const [k, v] of Object.entries(patch)) {
            for (const l of listeners) {
              l({ [k]: { oldValue: before[k], newValue: v } }, 'local')
            }
          }
        },
      },
      onChanged: {
        addListener: (l: (typeof listeners)[number]) => listeners.push(l),
        removeListener: (l: (typeof listeners)[number]) => {
          const i = listeners.indexOf(l)
          if (i >= 0) listeners.splice(i, 1)
        },
      },
    },
  } as unknown as typeof chrome
  return store
}

afterEach(() => {
  // @ts-expect-error test-only teardown of the global chrome mock
  delete globalThis.chrome
})

describe('readPrefs', () => {
  it('returns defaults when nothing is stored', async () => {
    installChromeStorage()
    expect(await readPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('falls back to defaults when storage throws', async () => {
    globalThis.chrome = {
      storage: { local: { get: async () => { throw new Error('boom') } } },
    } as unknown as typeof chrome
    expect(await readPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('migrates the legacy keepMinor boolean to filterStrength', async () => {
    installChromeStorage({ prefs: { keepMinor: true } })
    const prefs = await readPrefs()
    expect(prefs.filterStrength).toBe('off')
  })

  it('drops a stored pauseUntil of 0 or negative back to 0 (not paused)', async () => {
    installChromeStorage({ prefs: { pauseUntil: -5 } })
    const prefs = await readPrefs()
    expect(prefs.pauseUntil).toBe(0)
  })

  it('coerces a per-site override without discarding the other sites', async () => {
    installChromeStorage({ prefs: { sites: { chatgpt: false } } })
    const prefs = await readPrefs()
    expect(prefs.sites.chatgpt).toBe(false)
    expect(prefs.sites.claude).toBe(true)
  })
})

describe('writePrefs', () => {
  it('merges a partial update without clobbering other settings', async () => {
    const store = installChromeStorage({ prefs: { ...DEFAULT_PREFS, filterStrength: 'strict' } })
    await writePrefs({ resurfaceClick: 'copy' })
    const saved = store.prefs as Prefs
    expect(saved.resurfaceClick).toBe('copy')
    expect(saved.filterStrength).toBe('strict')
  })

  it('serializes two concurrent same-context writes instead of losing one', async () => {
    installChromeStorage()
    // Fire both without awaiting the first — this is exactly the race the
    // module-scope write chain in prefs.ts exists to close.
    await Promise.all([writePrefs({ resurfaceClick: 'copy' }), writePrefs({ minorNoticeSeen: true })])
    const prefs = await readPrefs()
    expect(prefs.resurfaceClick).toBe('copy')
    expect(prefs.minorNoticeSeen).toBe(true)
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
    await expect(writePrefs({ resurfaceClick: 'copy' })).resolves.toBeUndefined()
  })
})

describe('isPaused', () => {
  it('is false when pauseUntil is 0', () => {
    expect(isPaused({ ...DEFAULT_PREFS, pauseUntil: 0 }, 1000)).toBe(false)
  })

  it('is true while now is before pauseUntil', () => {
    expect(isPaused({ ...DEFAULT_PREFS, pauseUntil: 2000 }, 1000)).toBe(true)
  })

  it('is false once now reaches pauseUntil', () => {
    expect(isPaused({ ...DEFAULT_PREFS, pauseUntil: 1000 }, 1000)).toBe(false)
  })

  it('PAUSE_FOREVER stays paused far into the future', () => {
    expect(isPaused({ ...DEFAULT_PREFS, pauseUntil: PAUSE_FOREVER }, Date.now() + 1e15)).toBe(true)
  })
})

describe('the in-page surface preferences', () => {
  it('turns the new helpers on for installs that predate them', async () => {
    // These keys did not exist before, so an existing prefs blob has no opinion
    // about them. Absent must mean on, or nobody who already had Deja would
    // ever see the new surfaces.
    installChromeStorage({ prefs: { resurfaceClick: 'insert' } })
    const prefs = await readPrefs()
    expect(prefs.inPageDot).toBe(true)
    expect(prefs.slashPicker).toBe(true)
    expect(prefs.learnFromUse).toBe(true)
  })

  it('honours an explicit opt-out', async () => {
    installChromeStorage({ prefs: { inPageDot: false, slashPicker: false, learnFromUse: false } })
    const prefs = await readPrefs()
    expect(prefs.inPageDot).toBe(false)
    expect(prefs.slashPicker).toBe(false)
    expect(prefs.learnFromUse).toBe(false)
  })

  it('drops unknown or malformed example topics', async () => {
    installChromeStorage({ prefs: { intents: ['email', 'nonsense', 42, 'email'] } })
    expect((await readPrefs()).intents).toEqual(['email'])
  })

  it('treats a non-list of topics as no choice at all', async () => {
    installChromeStorage({ prefs: { intents: 'email' } })
    expect((await readPrefs()).intents).toEqual([])
  })
})
