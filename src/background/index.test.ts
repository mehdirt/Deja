import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CaptureResponse } from '@/lib/types'

// The capture handler decides, per message, between three outcomes: bump an
// existing row's usage, skip a throwaway, or store. The order of those checks
// is load-bearing and easy to break by accident — the near-duplicate scan reads
// the whole table, so it sits behind the cheap checks, and a throwaway must not
// fall through it into a write. These tests pin that order.

const findExistingPrompt = vi.fn()
const listPrompts = vi.fn()
const touchUsage = vi.fn()
const savePrompt = vi.fn()
const findSimilar = vi.fn()
const classifyPrompt = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    // The real handler wraps its check-then-write in one Dexie transaction;
    // running the callback straight through is the same sequence for our
    // purposes, since these tests drive one message at a time.
    transaction: (_mode: string, _table: unknown, fn: () => unknown) => fn(),
    prompts: {},
  },
  findExistingPrompt: (...a: unknown[]) => findExistingPrompt(...a),
  listPrompts: (...a: unknown[]) => listPrompts(...a),
  touchUsage: (...a: unknown[]) => touchUsage(...a),
  savePrompt: (...a: unknown[]) => savePrompt(...a),
  hardDelete: vi.fn(),
  touchDismiss: vi.fn(),
  purgeExpiredDeleted: vi.fn().mockResolvedValue(0),
}))
vi.mock('@/lib/similarity', () => ({ findSimilar: (...a: unknown[]) => findSimilar(...a) }))
vi.mock('@/lib/classify', () => ({ classifyPrompt: (...a: unknown[]) => classifyPrompt(...a) }))
vi.mock('@/lib/libraryCap', () => ({ trimLibraryToCap: vi.fn().mockResolvedValue(0) }))
vi.mock('@/lib/piiVault', () => ({ mergePiiVault: vi.fn(), readPiiVault: vi.fn(async () => ({})) }))
vi.mock('@/lib/pii', () => ({ redactPii: vi.fn() }))
vi.mock('@/background/pool', () => ({
  getIndex: vi.fn(),
  getPool: vi.fn(async () => []),
  invalidatePool: vi.fn(),
}))
const writePrefs = vi.fn()
let storedPrefs: Record<string, unknown> = {}

vi.mock('@/lib/prefs', () => ({
  PAUSE_FOREVER: 0,
  isPaused: () => false,
  onPrefsChange: () => () => {},
  readPrefs: async () => ({
    redactPii: false,
    filterStrength: 'balanced',
    libraryCap: 0,
    ...storedPrefs,
  }),
  writePrefs: (...a: unknown[]) => writePrefs(...a),
}))

type Listener = (
  message: unknown,
  sender: unknown,
  sendResponse: (r: CaptureResponse) => void,
) => boolean | undefined

const listeners: Listener[] = []

vi.stubGlobal('chrome', {
  runtime: {
    onMessage: { addListener: (fn: Listener) => listeners.push(fn) },
    onInstalled: { addListener: () => {} },
    getURL: (p: string) => p,
  },
  tabs: { create: () => Promise.resolve() },
  action: {
    setBadgeText: () => Promise.resolve(),
    setBadgeBackgroundColor: () => Promise.resolve(),
  },
  alarms: { clear: async () => {}, create: async () => {}, onAlarm: { addListener: () => {} } },
  storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: () => {} } },
})

await import('./index')

/** Drive one PROMPT_CAPTURED message through the registered handler. */
function capture(text: string): Promise<CaptureResponse> {
  return new Promise((resolve) => {
    for (const fn of listeners) {
      fn(
        { type: 'PROMPT_CAPTURED', payload: { text, platform: 'chatgpt', url: 'https://x/y' } },
        {},
        resolve,
      )
    }
  })
}

describe('PROMPT_CAPTURED handler', () => {
  beforeEach(() => {
    for (const m of [findExistingPrompt, listPrompts, touchUsage, savePrompt, findSimilar])
      m.mockReset()
    classifyPrompt.mockReset()
    writePrefs.mockReset()
    storedPrefs = { minorNoticeSeen: true, shortNoticeSeen: true }
    findExistingPrompt.mockResolvedValue(undefined)
    listPrompts.mockResolvedValue([])
    findSimilar.mockReturnValue([])
    savePrompt.mockResolvedValue(7)
    classifyPrompt.mockReturnValue({ minor: false, reason: null })
  })

  it('stores a prompt that is not a throwaway or a duplicate', async () => {
    const resp = await capture('draft a note to my landlord')
    expect(savePrompt).toHaveBeenCalled()
    expect(resp).toMatchObject({ ok: true, id: 7, filtered: false })
  })

  it('skips glue without reading the whole table', async () => {
    classifyPrompt.mockReturnValue({ minor: true, reason: 'trivial' })
    const resp = await capture('ok thanks')
    expect(resp).toMatchObject({ ok: true, filtered: true })
    expect(savePrompt).not.toHaveBeenCalled()
    // The point of the ordering: the near-duplicate scan is the expensive step
    // and glue is the most frequent message, so it must not run here.
    expect(listPrompts).not.toHaveBeenCalled()
    expect(findSimilar).not.toHaveBeenCalled()
  })

  it("still credits a near-duplicate when 'strict' calls the prompt too short", async () => {
    classifyPrompt.mockReturnValue({ minor: true, reason: 'short' })
    findSimilar.mockReturnValue([{ item: { id: 3, text: 'draft the email' }, score: 0.9 }])
    const resp = await capture('draft the email')
    expect(findSimilar).toHaveBeenCalled()
    expect(touchUsage).toHaveBeenCalledWith(3)
    expect(resp).toMatchObject({ duplicate: true, id: 3 })
    expect(savePrompt).not.toHaveBeenCalled()
  })

  it("never stores a 'short' skip that matched nothing", async () => {
    classifyPrompt.mockReturnValue({ minor: true, reason: 'short' })
    const resp = await capture('make it blue')
    expect(savePrompt).not.toHaveBeenCalled()
    expect(resp).toMatchObject({ ok: true, filtered: true })
  })

  // The two skips explain themselves once each, and the counters are separate.
  // Sharing one would mean a person on 'strict' whose first skip happened to be
  // glue never learns that the strength they picked is dropping their short
  // prompts — the setting people most often forget they turned on.
  it('explains a strict skip even after glue has already used its notice', async () => {
    storedPrefs = { minorNoticeSeen: true, shortNoticeSeen: false }
    classifyPrompt.mockReturnValue({ minor: true, reason: 'short' })
    const resp = await capture('make it blue')
    expect(resp).toMatchObject({ filtered: true, notice: true, reason: 'short' })
    expect(writePrefs).toHaveBeenCalledWith({ shortNoticeSeen: true })
  })

  it('stays quiet once each skip has explained itself', async () => {
    storedPrefs = { minorNoticeSeen: true, shortNoticeSeen: true }
    classifyPrompt.mockReturnValue({ minor: true, reason: 'short' })
    expect(await capture('make it blue')).toMatchObject({ notice: false })
    classifyPrompt.mockReturnValue({ minor: true, reason: 'trivial' })
    expect(await capture('ok thanks')).toMatchObject({ notice: false })
    expect(writePrefs).not.toHaveBeenCalled()
  })

  it('bumps usage on an exact re-send even when the filter would skip it now', async () => {
    classifyPrompt.mockReturnValue({ minor: true, reason: 'trivial' })
    findExistingPrompt.mockResolvedValue({ id: 11, text: 'continue' })
    const resp = await capture('continue')
    expect(touchUsage).toHaveBeenCalledWith(11)
    expect(resp).toMatchObject({ duplicate: true, id: 11 })
  })
})
