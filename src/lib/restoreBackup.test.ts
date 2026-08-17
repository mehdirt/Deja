import { beforeEach, describe, expect, it, vi } from 'vitest'

const { importPrompts, trimLibraryToCap } = vi.hoisted(() => ({
  importPrompts: vi.fn(),
  trimLibraryToCap: vi.fn(),
}))

vi.mock('./db', () => ({ importPrompts }))
vi.mock('./libraryCap', () => ({ trimLibraryToCap }))

import { restoreBackupFromText } from './restoreBackup'

describe('restoreBackupFromText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    importPrompts.mockResolvedValue({ imported: 2, skipped: 1 })
    trimLibraryToCap.mockResolvedValue(0)
  })

  it('rejects invalid JSON', async () => {
    await expect(restoreBackupFromText('{', 0)).resolves.toEqual({
      ok: false,
      message: "Couldn't read that file. It should be a backup from Deja.",
    })
    expect(importPrompts).not.toHaveBeenCalled()
  })

  it('rejects valid JSON that is not an array', async () => {
    await expect(restoreBackupFromText('{"prompts":[]}', 0)).resolves.toEqual({
      ok: false,
      message: "That file isn't a Deja backup.",
    })
    expect(importPrompts).not.toHaveBeenCalled()
  })

  it('reports imported and skipped prompts', async () => {
    await expect(restoreBackupFromText('[{"text":"hello"}]', 0)).resolves.toEqual({
      ok: true,
      imported: 2,
      skipped: 1,
      message: 'Added 2. Skipped 1 you already had.',
    })
    expect(importPrompts).toHaveBeenCalledWith([{ text: 'hello' }])
    expect(trimLibraryToCap).not.toHaveBeenCalled()
  })

  it('uses singular wording when library cap removes one prompt', async () => {
    trimLibraryToCap.mockResolvedValue(1)

    await expect(restoreBackupFromText('[]', 100)).resolves.toMatchObject({
      ok: true,
      message: 'Added 2. Skipped 1 you already had. Removed 1 rarely used prompt to stay under your limit.',
    })
  })

  it('uses plural wording when library cap removes multiple prompts', async () => {
    trimLibraryToCap.mockResolvedValue(3)

    await expect(restoreBackupFromText('[]', 100)).resolves.toMatchObject({
      ok: true,
      message: 'Added 2. Skipped 1 you already had. Removed 3 rarely used prompts to stay under your limit.',
    })
  })
})
