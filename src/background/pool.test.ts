import { beforeEach, describe, expect, it, vi } from 'vitest'

// The pool cache exists to stop two full-table reads per keystroke. What it
// must never do is serve a stale row after a write — especially the two writes
// that only bump counters, since those are exactly the fields the suggestion
// ordering reads.

const listPrompts = vi.fn()
vi.mock('@/lib/db', () => ({ listPrompts: (...args: unknown[]) => listPrompts(...args) }))

const { getPool, invalidatePool } = await import('./pool')

describe('pool cache', () => {
  beforeEach(() => {
    listPrompts.mockReset()
    listPrompts.mockResolvedValue([{ id: 1, text: 'hello', usageCount: 0 }])
    invalidatePool()
  })

  it('reads the table once and serves the rest from memory', async () => {
    await getPool(false)
    await getPool(false)
    await getPool(false)
    expect(listPrompts).toHaveBeenCalledTimes(1)
  })

  it('keeps the two pools apart', async () => {
    await getPool(false)
    await getPool(true)
    expect(listPrompts).toHaveBeenCalledTimes(2)
    expect(listPrompts).toHaveBeenCalledWith({ includeMinor: false })
    expect(listPrompts).toHaveBeenCalledWith({ includeMinor: true })
  })

  it('re-reads after any write invalidates it', async () => {
    await getPool(false)
    invalidatePool()
    await getPool(false)
    expect(listPrompts).toHaveBeenCalledTimes(2)
  })

  it('serves the last good rows when the database fails', async () => {
    const rows = await getPool(false)
    expect(rows).toHaveLength(1)
    invalidatePool()
    listPrompts.mockRejectedValueOnce(new Error('nope'))
    // Nothing cached after invalidation, so a failure yields an empty pool
    // rather than throwing into the message handler.
    await expect(getPool(false)).resolves.toEqual([])
  })
})
