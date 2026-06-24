import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { listPrompts, softDelete, restore, touchUsage, exportAll } from '@/lib/db'
import { buildIndex, searchPrompts } from '@/lib/search'
import { PromptCard } from '@/ui/PromptCard'
import { SkeletonList } from '@/ui/Skeleton'
import { Logo } from '@/ui/Logo'
import { PLATFORM_LABEL, type Platform, type Prompt } from '@/lib/types'

const PLATFORMS: Array<{ key: Platform | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  ...(Object.keys(PLATFORM_LABEL) as Platform[]).map((k) => ({ key: k, label: PLATFORM_LABEL[k] })),
]

type Sort = 'newest' | 'most-used' | 'longest-unseen'
const SORTS: Array<{ key: Sort; label: string }> = [
  { key: 'newest', label: 'newest' },
  { key: 'most-used', label: 'most used' },
  { key: 'longest-unseen', label: 'longest unseen' },
]

export function Library() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [selected, setSelected] = useState(0)
  const [undoId, setUndoId] = useState<number | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)
  const undoTimer = useRef<number | undefined>(undefined)

  const reload = useCallback(
    () =>
      listPrompts()
        .then(setPrompts)
        .finally(() => setLoading(false)),
    [],
  )
  useEffect(() => {
    reload()
  }, [reload])

  const filtered = useMemo(
    () => (platform === 'all' ? prompts : prompts.filter((p) => p.platform === platform)),
    [prompts, platform],
  )
  const index = useMemo(() => buildIndex(filtered), [filtered])

  const visible: Prompt[] = useMemo(() => {
    let list: Prompt[]
    if (!deferredQuery.trim()) {
      list = [...filtered]
    } else {
      const hits = searchPrompts(index, deferredQuery, 200)
      const byId = new Map(filtered.map((p) => [p.id!, p]))
      list = hits.map((h) => byId.get(h.id as number)).filter(Boolean) as Prompt[]
    }
    if (sort === 'most-used') list.sort((a, b) => b.usageCount - a.usageCount)
    else if (sort === 'longest-unseen') list.sort((a, b) => a.lastUsedAt - b.lastUsedAt)
    // 'newest' keeps listPrompts() order (already createdAt desc); search keeps relevance order
    return list
  }, [deferredQuery, filtered, index, sort])

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, visible.length - 1)))
  }, [visible.length])

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const onCopy = useCallback(async (p: Prompt) => {
    await navigator.clipboard.writeText(p.text)
    if (p.id) await touchUsage(p.id)
  }, [])

  const onDelete = useCallback(
    async (p: Prompt) => {
      if (!p.id) return
      await softDelete(p.id)
      setUndoId(p.id)
      window.clearTimeout(undoTimer.current)
      undoTimer.current = window.setTimeout(() => setUndoId(null), 6000)
      reload()
    },
    [reload],
  )

  const onUndoDelete = useCallback(async () => {
    if (undoId == null) return
    await restore(undoId)
    setUndoId(null)
    reload()
  }, [undoId, reload])

  // Keyboard ergonomics — this is a power-user tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      const inSearch = active === searchRef.current
      // Don't hijack action keys while a control (button/input/select) is focused —
      // it would double-fire alongside that control's own handler.
      const onControl = !!active && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(active.tagName)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key === '/' && !inSearch) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key === 'Escape') {
        if (query) setQuery('')
        searchRef.current?.blur()
        return
      }
      if (!visible.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, visible.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter' && !onControl) {
        e.preventDefault()
        void onCopy(visible[selected])
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && !onControl) {
        e.preventDefault()
        void onDelete(visible[selected])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, selected, query, onCopy, onDelete])

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

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
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Logo size={26} />
          <p className="font-mono text-xs text-ink-faint">
            {prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'} · stored locally
          </p>
        </div>
        <button onClick={onExport} className="ps-btn">
          Export JSON
        </button>
      </header>

      <div className="relative">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your prompts"
          placeholder="search your shelf…"
          className="ps-input pr-12 font-mono"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
          ⌘K
        </kbd>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by platform">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={platform === p.key}
              onClick={() => setPlatform(p.key)}
              className={`ps-pill ${platform === p.key ? 'ps-pill-active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort prompts"
          className="ps-input w-auto py-1 font-mono text-xs"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {undoId != null && (
        <div className="flex items-center justify-between rounded-btn border border-line bg-sunk px-3 py-2 text-sm">
          <span className="text-ink-soft">prompt deleted</span>
          <button onClick={onUndoDelete} className="ps-btn ps-btn-ghost px-2 py-1 font-mono text-xs">
            undo
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {loading ? (
          <SkeletonList count={4} />
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm">
            {prompts.length === 0 ? (
              <>
                <p className="text-ink">your shelf is empty — that's fine.</p>
                <p className="mt-1 text-ink-faint">
                  nothing to set up. send a prompt on chatgpt, claude, or gemini and it lands here
                  automatically.
                </p>
              </>
            ) : (
              <p className="text-ink-faint">no matches for this filter.</p>
            )}
          </div>
        ) : (
          visible.map((p, i) => (
            <PromptCard
              key={p.id}
              ref={i === selected ? selectedRef : undefined}
              prompt={p}
              selected={i === selected}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
