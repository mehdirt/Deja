import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  listPrompts,
  softDelete,
  restore,
  touchUsage,
  exportAll,
  togglePin,
  addTag,
  removeTag,
  bulkSoftDelete,
  bulkRestore,
  importPrompts,
} from '@/lib/db'
import { buildIndex, searchPrompts } from '@/lib/search'
import { buildMarkdown } from '@/lib/markdown'
import { usefulnessScore } from '@/lib/ranking'
import { PromptCard } from '@/ui/PromptCard'
import { SkeletonList } from '@/ui/Skeleton'
import { PinIcon } from '@/ui/PinIcon'
import { CaptureStatus } from '@/ui/CaptureStatus'
import { PLATFORM_LABEL, type Platform, type Prompt } from '@/lib/types'

const PLATFORMS: Array<{ key: Platform | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  ...(Object.keys(PLATFORM_LABEL) as Platform[]).map((k) => ({ key: k, label: PLATFORM_LABEL[k] })),
]

type Sort = 'newest' | 'most-useful' | 'most-used' | 'longest-unseen'
const SORTS: Array<{ key: Sort; label: string }> = [
  { key: 'newest', label: 'newest' },
  { key: 'most-useful', label: 'most useful' },
  { key: 'most-used', label: 'most used' },
  { key: 'longest-unseen', label: 'longest unseen' },
]

export function Library() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  // Seed the search from a ?q= deep link (the resurface tooltip's "see all"
  // opens the library pre-searched with the user's in-progress text).
  const [query, setQuery] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('q') ?? ''
    } catch {
      return ''
    }
  })
  const deferredQuery = useDeferredValue(query)
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [selected, setSelected] = useState(0)
  const [undoId, setUndoId] = useState<number | null>(null)
  // Tag filter: AND semantics. A prompt must carry EVERY active tag to show.
  // AND is the more useful default — as you click tags you narrow toward the
  // exact prompt you're after, rather than widening the result set (OR).
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  // Bulk selection mode + the set of selected ids and the last batch undone.
  const [selecting, setSelecting] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [undoBatch, setUndoBatch] = useState<number[] | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)

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

  // Every tag in use across the (platform-scoped) library, for the filter row.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of prompts) for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.keys()].sort()
  }, [prompts])

  const filtered = useMemo(() => {
    let list = platform === 'all' ? prompts : prompts.filter((p) => p.platform === platform)
    if (favoritesOnly) list = list.filter((p) => p.pinned ?? false)
    if (activeTags.length) {
      // AND: keep prompts that carry every active tag. Undefined tags → [].
      list = list.filter((p) => {
        const tags = p.tags ?? []
        return activeTags.every((t) => tags.includes(t))
      })
    }
    return list
  }, [prompts, platform, favoritesOnly, activeTags])
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
    if (sort === 'most-useful') {
      const now = Date.now()
      list.sort((a, b) => usefulnessScore(b, now) - usefulnessScore(a, now))
    } else if (sort === 'most-used') list.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))
    else if (sort === 'longest-unseen') list.sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))
    // 'newest' keeps listPrompts() order (already createdAt desc); search keeps relevance order
    // Pinned prompts always float to the top within the library, regardless of
    // sort. sort() is stable, so the chosen order is preserved within each group.
    list.sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false))
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
      setUndoBatch(null)
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

  const onTogglePin = useCallback(
    async (p: Prompt) => {
      if (!p.id) return
      await togglePin(p.id)
      reload()
    },
    [reload],
  )

  const onAddTag = useCallback(
    async (p: Prompt, tag: string) => {
      if (!p.id) return
      await addTag(p.id, tag)
      reload()
    },
    [reload],
  )

  const onRemoveTag = useCallback(
    async (p: Prompt, tag: string) => {
      if (!p.id) return
      await removeTag(p.id, tag)
      reload()
    },
    [reload],
  )

  const onTagClick = useCallback((tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }, [])

  const onToggleCheck = useCallback((p: Prompt) => {
    if (!p.id) return
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(p.id!)) next.delete(p.id!)
      else next.add(p.id!)
      return next
    })
  }, [])

  const exitSelecting = useCallback(() => {
    setSelecting(false)
    setCheckedIds(new Set())
  }, [])

  const onBulkDelete = useCallback(async () => {
    const ids = [...checkedIds]
    if (!ids.length) return
    await bulkSoftDelete(ids)
    setUndoId(null)
    setUndoBatch(ids)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndoBatch(null), 6000)
    exitSelecting()
    reload()
  }, [checkedIds, reload, exitSelecting])

  const onUndoBatch = useCallback(async () => {
    if (!undoBatch) return
    await bulkRestore(undoBatch)
    setUndoBatch(null)
    reload()
  }, [undoBatch, reload])

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
        if (selecting) exitSelecting()
        if (query) setQuery('')
        searchRef.current?.blur()
        return
      }
      // In bulk-select mode the per-row checkbox is the delete path; don't let
      // the single-item arrow/Enter/Backspace shortcuts compete with it.
      if (selecting) return
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
  }, [visible, selected, query, onCopy, onDelete, selecting, exitSelecting])

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  const fileRef = useRef<HTMLInputElement>(null)

  function download(content: string, type: string, ext: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deja-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onExport = async () => {
    const all = await exportAll()
    download(JSON.stringify(all, null, 2), 'application/json', 'json')
  }

  // Markdown export — one readable .md file. buildMarkdown filters out
  // soft-deleted rows and picks a fence longer than any backtick run in the
  // text so multi-line / code prompts survive the round trip.
  const onExportMarkdown = async () => {
    const all = await exportAll()
    download(buildMarkdown(all), 'text/markdown', 'md')
  }

  const onPickImport = () => fileRef.current?.click()

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    setImportMsg(null)
    try {
      const parsed = JSON.parse(await file.text())
      // A deja export is a JSON array of prompts. Anything else parses
      // fine but isn't ours — say so plainly instead of reporting "imported 0",
      // which reads like a successful no-op.
      if (!Array.isArray(parsed)) {
        setImportMsg("that file isn't a deja export")
        return
      }
      const res = await importPrompts(parsed)
      setImportMsg(`imported ${res.imported} · skipped ${res.skipped}`)
      reload()
    } catch {
      setImportMsg("couldn't read that file — expected a deja json export")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink-faint">
          {prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'} · stored locally
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
            aria-hidden
          />
          <button onClick={onPickImport} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
            import json
          </button>
          <button
            onClick={onExportMarkdown}
            disabled={prompts.length === 0}
            className="dj-btn px-2 py-1 text-xs disabled:opacity-40"
          >
            export md
          </button>
          <button
            onClick={onExport}
            disabled={prompts.length === 0}
            className="dj-btn px-2 py-1 text-xs disabled:opacity-40"
          >
            export json
          </button>
        </div>
      </header>

      {importMsg && (
        <div className="rounded-btn border border-line bg-sunk px-3 py-2 font-mono text-xs text-ink-soft">
          {importMsg}
        </div>
      )}

      <CaptureStatus />

      <div className="relative">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search your prompts"
          placeholder="search your prompts…"
          className="dj-input pr-12 font-mono"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
          ⌘K
        </kbd>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by platform">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={platform === p.key}
                onClick={() => setPlatform(p.key)}
                className={`dj-pill ${platform === p.key ? 'dj-pill-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* favorites = pinned only. A switch, not a filter pill: the platform
              tabs are single-select (radio-like), so an identical-looking pill
              hid that this is an independent on/off toggle. The divider + track
              make its state unmistakable. */}
          <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />
          <button
            role="switch"
            aria-checked={favoritesOnly}
            aria-label="Show favorites only"
            onClick={() => setFavoritesOnly((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-sunk focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <span
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                favoritesOnly ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 rounded-full bg-surface shadow-sm transition-transform ${
                  favoritesOnly ? 'translate-x-[14px]' : 'translate-x-0.5'
                }`}
              />
            </span>
            <PinIcon filled={favoritesOnly} />
            <span className={favoritesOnly ? 'text-ink' : undefined}>favorites</span>
          </button>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort prompts"
          className="dj-input w-auto py-1 font-mono text-xs"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by tag (AND)">
          {allTags.map((t) => {
            const active = activeTags.includes(t)
            return (
              <button
                key={t}
                aria-pressed={active}
                onClick={() => onTagClick(t)}
                className={`dj-tag ${active ? 'dj-tag-active' : ''}`}
              >
                {t}
              </button>
            )
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => setActiveTags([])}
              className="dj-btn dj-btn-ghost px-2 py-0.5 font-mono text-[11px]"
            >
              clear tags
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {selecting ? (
          <>
            <span className="font-mono text-xs text-ink-faint">{checkedIds.size} selected</span>
            <div className="flex gap-2">
              <button onClick={exitSelecting} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
                cancel
              </button>
              <button
                onClick={onBulkDelete}
                disabled={checkedIds.size === 0}
                className="dj-btn px-2 py-1 text-xs hover:text-danger disabled:opacity-40"
              >
                delete selected
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setSelecting(true)}
            className="dj-btn dj-btn-ghost px-2 py-1 font-mono text-xs"
          >
            select
          </button>
        )}
      </div>

      {undoId != null && (
        <div className="flex items-center justify-between rounded-btn border border-line bg-sunk px-3 py-2 text-sm">
          <span className="text-ink-soft">prompt deleted</span>
          <button onClick={onUndoDelete} className="dj-btn dj-btn-ghost px-2 py-1 font-mono text-xs">
            undo
          </button>
        </div>
      )}

      {undoBatch != null && (
        <div className="flex items-center justify-between rounded-btn border border-line bg-sunk px-3 py-2 text-sm">
          <span className="text-ink-soft">
            {undoBatch.length} {undoBatch.length === 1 ? 'prompt' : 'prompts'} deleted
          </span>
          <button onClick={onUndoBatch} className="dj-btn dj-btn-ghost px-2 py-1 font-mono text-xs">
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
                <p className="text-ink">nothing here yet — that&apos;s fine.</p>
                <p className="mt-1 text-ink-faint">
                  nothing to set up. send a prompt on chatgpt, claude, gemini, deepseek, or grok and
                  it lands here automatically.
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
              onTogglePin={onTogglePin}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onTagClick={onTagClick}
              activeTags={activeTags}
              selectable={selecting}
              checked={p.id != null && checkedIds.has(p.id)}
              onToggleCheck={onToggleCheck}
            />
          ))
        )}
      </div>
    </div>
  )
}
