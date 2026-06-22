import MiniSearch from 'minisearch'
import type { Prompt } from './types'

export function buildIndex(prompts: Prompt[]): MiniSearch<Prompt> {
  const ms = new MiniSearch<Prompt>({
    fields: ['text', 'platform'],
    storeFields: ['id', 'text', 'platform', 'createdAt', 'usageCount', 'lastUsedAt'],
    idField: 'id',
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { text: 2 } },
  })
  ms.addAll(prompts.filter((p) => p.id != null))
  return ms
}

export function searchPrompts(index: MiniSearch<Prompt>, query: string, limit = 50) {
  if (!query.trim()) return []
  return index.search(query).slice(0, limit)
}
