import { describe, expect, it } from 'vitest'
import { normalizeImportedRow, contentKey } from './db'

describe('normalizeImportedRow', () => {
  it('coalesces missing optional fields to sensible defaults', () => {
    const row = normalizeImportedRow({
      text: 'write a haiku about the sea',
      platform: 'chatgpt',
      createdAt: 1000,
    })
    expect(row).not.toBeNull()
    expect(row).toMatchObject({
      text: 'write a haiku about the sea',
      platform: 'chatgpt',
      createdAt: 1000,
      usageCount: 0,
      lastUsedAt: 1000, // defaults to createdAt
      url: '',
      tags: [],
      pinned: false,
      deletedAt: null,
    })
  })

  it('drops the id so imported rows become new rows', () => {
    const row = normalizeImportedRow({ id: 42, text: 'hello world', platform: 'claude', createdAt: 5 })
    expect(row).not.toBeNull()
    expect('id' in (row as object)).toBe(false)
  })

  it('preserves a deletedAt tombstone (never resurrects)', () => {
    const row = normalizeImportedRow({
      text: 'deleted prompt here',
      platform: 'gemini',
      createdAt: 10,
      deletedAt: 99,
    })
    expect(row?.deletedAt).toBe(99)
  })

  it('normalizes tags (trim/lowercase/dedupe) and keeps pinned', () => {
    const row = normalizeImportedRow({
      text: 'tagged prompt',
      platform: 'grok',
      createdAt: 1,
      tags: [' Work ', 'work', 'IDEAS'],
      pinned: true,
    })
    expect(row?.tags).toEqual(['work', 'ideas'])
    expect(row?.pinned).toBe(true)
  })

  it('rejects rows with no/too-short text', () => {
    expect(normalizeImportedRow({ text: 'a', platform: 'chatgpt', createdAt: 1 })).toBeNull()
    expect(normalizeImportedRow({ platform: 'chatgpt', createdAt: 1 })).toBeNull()
  })

  it('rejects rows with an unknown platform', () => {
    expect(normalizeImportedRow({ text: 'hello there', platform: 'bard', createdAt: 1 })).toBeNull()
  })

  it('rejects non-objects', () => {
    expect(normalizeImportedRow(null)).toBeNull()
    expect(normalizeImportedRow('nope')).toBeNull()
    expect(normalizeImportedRow(123)).toBeNull()
  })

  it('defaults a non-numeric createdAt to now and mirrors it to lastUsedAt', () => {
    const before = Date.now()
    const row = normalizeImportedRow({ text: 'no timestamp here', platform: 'chatgpt' })
    expect(row).not.toBeNull()
    expect(row!.createdAt).toBeGreaterThanOrEqual(before)
    expect(row!.lastUsedAt).toBe(row!.createdAt)
  })
})

describe('contentKey', () => {
  it('is stable for the same platform/createdAt/text', () => {
    const a = contentKey({ platform: 'chatgpt', createdAt: 5, text: 'same' })
    const b = contentKey({ platform: 'chatgpt', createdAt: 5, text: 'same' })
    expect(a).toBe(b)
  })

  it('differs when any component differs', () => {
    const base = contentKey({ platform: 'chatgpt', createdAt: 5, text: 'x' })
    expect(contentKey({ platform: 'claude', createdAt: 5, text: 'x' })).not.toBe(base)
    expect(contentKey({ platform: 'chatgpt', createdAt: 6, text: 'x' })).not.toBe(base)
    expect(contentKey({ platform: 'chatgpt', createdAt: 5, text: 'y' })).not.toBe(base)
  })
})
