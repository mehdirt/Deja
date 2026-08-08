import { useDeferredValue, useMemo, useState } from 'react'
import { listPrompts, touchUsage } from '@/lib/db'
import { buildIndex, searchPrompts } from '@/lib/search'
import { PromptCard } from '@/ui/PromptCard'
import { SkeletonList } from '@/ui/Skeleton'
import { ErrorRetry } from '@/ui/ErrorRetry'
import { Logo } from '@/ui/Logo'
import { PauseControl } from '@/ui/PauseControl'
import { SearchIcon, CloseIcon } from '@/ui/ActionIcons'
import { useAsyncList } from '@/ui/useAsyncList'
import type { Prompt } from '@/lib/types'

export function Popup() {
  const { items: prompts, loading, loadError, reload } = useAsyncList(listPrompts)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const index = useMemo(() => buildIndex(prompts), [prompts])
  const visible: Prompt[] = useMemo(() => {
    if (!deferredQuery.trim()) {
      // Recent by createdAt (listPrompts already desc). Favorites stay in place —
      // they only filter out when Favorites is on in the full library.
      return prompts.slice(0, 5)
    }
    const hits = searchPrompts(index, deferredQuery, 10)
    const byId = new Map(prompts.map((p) => [p.id!, p]))
    return hits.map((h) => byId.get(h.id as number)).filter(Boolean) as Prompt[]
  }, [deferredQuery, prompts, index])

  const onCopy = async (p: Prompt, text?: string) => {
    try {
      await navigator.clipboard.writeText(text ?? p.text)
      if (p.id) await touchUsage(p.id)
    } catch {
      /* clipboard write can reject without document focus in a popup — no-op */
    }
  }

  const openLibrary = () => chrome.runtime.openOptionsPage()

  return (
    <div className="flex max-h-[560px] min-h-[400px] flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-bg/90 px-3.5 py-3 backdrop-blur">
        <Logo size={26} />
        <button onClick={openLibrary} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
          All prompts →
        </button>
      </header>

      <div className="flex flex-col gap-2.5 px-3.5 pt-3.5">
        <PauseControl />
        <div className="dj-search">
          <SearchIcon size={14} className="dj-search-icon" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your prompts"
            placeholder="Find a prompt…"
            className="dj-search-input"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="dj-search-clear"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="dj-stagger flex flex-1 flex-col gap-2 overflow-auto p-3.5">
        {loading ? (
          <SkeletonList count={3} />
        ) : loadError && prompts.length === 0 ? (
          <ErrorRetry onRetry={reload} compact />
        ) : visible.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-ink-soft">
            {prompts.length === 0 ? (
              <>
                <p className="text-ink">Your library is empty for now — that&apos;s perfectly fine 🌱</p>
                <p className="mt-1 text-ink-faint">
                  Nothing to set up. Ask ChatGPT, Claude, Gemini, DeepSeek, or Grok something, and
                  it&apos;ll land here gently on its own.
                </p>
              </>
            ) : (
              <p className="text-ink-faint">No matches this time — try a different word?</p>
            )}
          </div>
        ) : (
          visible.map((p, i) => (
            <div key={p.id} style={{ ['--i' as string]: Math.min(i, 7) }}>
              <PromptCard prompt={p} onCopy={onCopy} compact />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
