import Dexie, { type Table } from 'dexie'
import type { Prompt } from './types'

class PromptShelfDB extends Dexie {
  prompts!: Table<Prompt, number>

  constructor() {
    super('promptshelf')
    this.version(1).stores({
      prompts: '++id, platform, createdAt, lastUsedAt, deletedAt',
    })
  }
}

export const db = new PromptShelfDB()

export async function savePrompt(input: Omit<Prompt, 'id' | 'usageCount' | 'lastUsedAt'>): Promise<number> {
  const now = input.createdAt
  return db.prompts.add({ ...input, usageCount: 0, lastUsedAt: now, deletedAt: null })
}

export async function listPrompts(): Promise<Prompt[]> {
  return db.prompts.where('deletedAt').equals(0).or('deletedAt').equals(null as never).reverse().sortBy('createdAt')
}

export async function softDelete(id: number): Promise<void> {
  await db.prompts.update(id, { deletedAt: Date.now() })
}

export async function touchUsage(id: number): Promise<void> {
  const now = Date.now()
  const p = await db.prompts.get(id)
  if (!p) return
  await db.prompts.update(id, { usageCount: (p.usageCount ?? 0) + 1, lastUsedAt: now })
}

export async function exportAll(): Promise<Prompt[]> {
  return db.prompts.toArray()
}
