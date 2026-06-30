import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { listPrompts, touchUsage } from '@/lib/db'
import { buildIndex, searchPrompts } from '@/lib/search'
import { PromptCard } from '@/ui/PromptCard'
import { SkeletonList } from '@/ui/Skeleton'
import { Logo } from '@/ui/Logo'
import { PauseControl } from '@/ui/PauseControl'
import type { Prompt } from '@/lib/types'

export function Popup() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    listPrompts()
      .then(setPrompts)
      .finally(() => setLoading(false))
  }, [])

  const index = useMemo(() => buildIndex(prompts), [prompts])
  const visible: Prompt[] = useMemo(() => {
    if (!deferredQuery.trim()) {
      // Pinned prompts sort to the top of the recent list, then by recency.
      // prompts is already createdAt desc, so a stable pinned-first sort keeps
      // recency order within each group. Treat undefined `pinned` as false.
      const ordered = [...prompts].sort(
        (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false),
      )
      return ordered.slice(0, 5)
    }
    const hits = searchPrompts(index, deferredQuery, 10)
    const byId = new Map(prompts.map((p) => [p.id!, p]))
    return hits.map((h) => byId.get(h.id as number)).filter(Boolean) as Prompt[]
  }, [deferredQuery, prompts, index])

  const onCopy = async (p: Prompt) => {
    await navigator.clipboard.writeText(p.text)
    if (p.id) await touchUsage(p.id)
  }

  const openLibrary = () => chrome.runtime.openOptionsPage()

  return (
    <div className="flex max-h-[560px] min-h-[400px] flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-bg/95 px-3 py-2.5 backdrop-blur">
        <Logo size={20} />
        <button onClick={openLibrary} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
          library →
        </button>
      </header>

      <div className="flex flex-col gap-2.5 px-3 pt-3">
        <PauseControl />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your prompts"
          placeholder="search your prompts…"
          className="dj-input font-mono"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-auto p-3">
        {loading ? (
          <SkeletonList count={3} />
        ) : visible.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-ink-soft">
            {prompts.length === 0 ? (
              <>
                <p className="text-ink">nothing here yet — that&apos;s fine.</p>
                <p className="mt-1 text-ink-faint">
                  nothing to set up. send a prompt on chatgpt, claude, gemini, deepseek, or grok and
                  it lands here.
                </p>
              </>
            ) : (
              <p className="text-ink-faint">no matches.</p>
            )}
          </div>
        ) : (
          visible.map((p) => <PromptCard key={p.id} prompt={p} onCopy={onCopy} compact />)
        )}
      </div>
    </div>
  )
}
