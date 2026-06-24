import { useEffect, useMemo, useState } from 'react'
import { listPrompts, softDelete, touchUsage, exportAll } from '@/lib/db'
import { buildIndex, searchPrompts } from '@/lib/search'
import { PromptCard } from '@/ui/PromptCard'
import type { Platform, Prompt } from '@/lib/types'

const PLATFORMS: Array<{ key: Platform | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'claude', label: 'Claude' },
  { key: 'gemini', label: 'Gemini' },
]

export function Library() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState<Platform | 'all'>('all')

  const reload = () => listPrompts().then(setPrompts)
  useEffect(() => {
    reload()
  }, [])

  const filtered = useMemo(
    () => (platform === 'all' ? prompts : prompts.filter((p) => p.platform === platform)),
    [prompts, platform],
  )
  const index = useMemo(() => buildIndex(filtered), [filtered])

  const visible: Prompt[] = useMemo(() => {
    if (!query.trim()) return filtered
    const hits = searchPrompts(index, query, 200)
    const byId = new Map(filtered.map((p) => [p.id!, p]))
    return hits.map((h) => byId.get(h.id as number)).filter(Boolean) as Prompt[]
  }, [query, filtered, index])

  const onCopy = async (p: Prompt) => {
    await navigator.clipboard.writeText(p.text)
    if (p.id) await touchUsage(p.id)
  }

  const onDelete = async (p: Prompt) => {
    if (!p.id) return
    await softDelete(p.id)
    reload()
  }

  const onExport = async () => {
    const all = await exportAll()
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `promptshelf-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PromptShelf</h1>
          <p className="text-sm text-ink-800/60 dark:text-ink-50/60">
            {prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'} saved locally
          </p>
        </div>
        <button
          onClick={onExport}
          className="text-sm px-3 py-1.5 rounded border border-ink-100 hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-800"
        >
          Export JSON
        </button>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your shelf…"
        className="w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm dark:bg-ink-800 dark:border-ink-800"
      />

      <div className="flex gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPlatform(p.key)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              platform === p.key
                ? 'bg-accent text-white border-accent'
                : 'border-ink-100 hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {visible.length === 0 && (
          <p className="text-sm text-ink-800/60 dark:text-ink-50/60 py-12 text-center">
            {prompts.length === 0
              ? 'Your shelf is empty. Send a prompt to ChatGPT, Claude, or Gemini and it will appear here.'
              : 'No matches for this filter.'}
          </p>
        )}
        {visible.map((p) => (
          <PromptCard key={p.id} prompt={p} onCopy={onCopy} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}
