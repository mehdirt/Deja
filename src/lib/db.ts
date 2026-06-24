import Dexie, { type Table } from 'dexie'
import type { Prompt } from './types'

class PromptShelfDB extends Dexie {
  prompts!: Table<Prompt, number>

  constructor() {
    super('promptshelf')
    this.version(1).stores({
      prompts: '++id, platform, createdAt, lastUsedAt',
    })
  }
}

export const db = new PromptShelfDB()

export async function savePrompt(input: Omit<Prompt, 'id' | 'usageCount' | 'lastUsedAt'>): Promise<number> {
  const now = input.createdAt
  return db.prompts.add({ ...input, usageCount: 0, lastUsedAt: now })
}

export async function listPrompts(): Promise<Prompt[]> {
  const all = await db.prompts.orderBy('createdAt').reverse().toArray()
  return all.filter((p) => !p.deletedAt)
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
