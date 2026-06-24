import { useEffect, useMemo, useState } from 'react'
import { listPrompts, touchUsage } from '@/lib/db'
import { buildIndex, searchPrompts } from '@/lib/search'
import { PromptCard } from '@/ui/PromptCard'
import type { Prompt } from '@/lib/types'

export function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    listPrompts().then(setPrompts)
  }, [])

  const index = useMemo(() => buildIndex(prompts), [prompts])
  const visible: Prompt[] = useMemo(() => {
    if (!query.trim()) return prompts.slice(0, 5)
    const hits = searchPrompts(index, query, 10)
    const byId = new Map(prompts.map((p) => [p.id!, p]))
    return hits.map((h) => byId.get(h.id as number)).filter(Boolean) as Prompt[]
  }, [query, prompts, index])

  const onCopy = async (p: Prompt) => {
    await navigator.clipboard.writeText(p.text)
    if (p.id) await touchUsage(p.id)
  }

  const openLibrary = () => chrome.runtime.openOptionsPage()

  return (
    <div className="p-3 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">PromptShelf</h1>
        <button onClick={openLibrary} className="text-xs text-accent hover:underline">
          Open library →
        </button>
      </header>
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your prompts…"
        className="w-full rounded-md border border-ink-100 bg-white px-3 py-2 text-sm dark:bg-ink-800 dark:border-ink-800"
      />
      <div className="flex flex-col gap-2 max-h-[420px] overflow-auto">
        {visible.length === 0 && (
          <p className="text-sm text-ink-800/60 dark:text-ink-50/60 py-6 text-center">
            {prompts.length === 0
              ? 'No prompts yet. Send a prompt on ChatGPT, Claude, or Gemini to start your shelf.'
              : 'No matches.'}
          </p>
        )}
        {visible.map((p) => (
          <PromptCard key={p.id} prompt={p} onCopy={onCopy} compact />
        ))}
      </div>
    </div>
  )
}
