import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  listPrompts,
  softDelete,
  restore,
  touchUsage,
  togglePin,
  addTag,
  removeTag,
  bulkSoftDelete,
  bulkRestore,
  finalizeSoftDelete,
  finalizeSoftDeletes,
  purgeExpiredDeleted,
  DELETE_UNDO_MS,
  setMinor,
} from '@/lib/db'
import { readPrefs, onPrefsChange } from '@/lib/prefs'
import { buildIndex, searchPrompts } from '@/lib/search'
import { usefulnessScore } from '@/lib/ranking'
import { PromptCard } from '@/ui/PromptCard'
import { SkeletonList } from '@/ui/Skeleton'
import { ErrorRetry } from '@/ui/ErrorRetry'
import { FavoriteIcon, ChevronIcon, SearchIcon, CloseIcon, LockIcon } from '@/ui/ActionIcons'
import { CaptureHealthBadge } from '@/ui/CaptureHealthBadge'
import { StarterPrompts } from '@/ui/StarterPrompts'
import { useAsyncList } from '@/ui/useAsyncList'
import { PLATFORM_LABEL, type Platform, type Prompt } from '@/lib/types'

const PLATFORMS: Array<{ key: Platform | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  ...(Object.keys(PLATFORM_LABEL) as Platform[]).map((k) => ({ key: k, label: PLATFORM_LABEL[k] })),
]

type Sort = 'newest' | 'most-useful' | 'most-used' | 'longest-unseen'
const SORTS: Array<{ key: Sort; label: string }> = [
  { key: 'newest', label: 'Newest first' },
  { key: 'most-useful', label: 'Handy lately' },
  { key: 'most-used', label: 'Reused most' },
  { key: 'longest-unseen', label: "Haven't used in a while" },
]

export function Library({ onOpenSettings }: { onOpenSettings?: () => void }) {
  // Fetch minors too — we filter them in-memory so the "filtered (N)" toggle
  // and per-prompt "keep" work without a second query.
  const {
    items: prompts,
    loading,
    loadError,
    reload,
  } = useAsyncList(() => listPrompts({ includeMinor: true }))
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
  const [undoId, setUndoId] = useState<number | null>(null)
  // Tag filter: AND semantics. A prompt must carry EVERY active tag to show.
  // AND is the more useful default — as you click tags you narrow toward the
  // exact prompt you're after, rather than widening the result set (OR).
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  // Legacy soft-capture rows (`minor`) are hidden by default. `showMinor`
  // reveals them so they can be kept/deleted; `keepMinor` means filter strength
  // is 'off', so they're always shown.
  const [showMinor, setShowMinor] = useState(false)
  const [keepMinor, setKeepMinor] = useState(false)
  // Bulk selection mode + the set of selected ids and the last batch undone.
  const [selecting, setSelecting] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [undoBatch, setUndoBatch] = useState<number[] | null>(null)

  const undoTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    // filterStrength === 'off' means the filter is disabled, so show every
    // prompt by default (the library's local equivalent of the old keepMinor).
    void readPrefs().then((p) => setKeepMinor(p.filterStrength === 'off'))
    return onPrefsChange((p) => setKeepMinor(p.filterStrength === 'off'))
  }, [])

  const minorCount = useMemo(() => prompts.filter((p) => p.minor).length, [prompts])
  // Only show the platform row when the library actually spans more than one
  // site — otherwise six equal pills are pure chrome for a single-site user.
  const multiPlatform = useMemo(() => new Set(prompts.map((p) => p.platform)).size > 1, [prompts])
  const filterActiveCount =
    (platform !== 'all' ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (sort !== 'newest' ? 1 : 0) +
    activeTags.length +
    (showMinor ? 1 : 0)
  // Headline count reflects the current scope: with minors hidden, don't count
  // them (the "filtered (N)" chip surfaces them separately) so the number always
  // matches what the user sees.
  const shownCount = keepMinor
    ? prompts.length
    : showMinor
      ? minorCount
      : prompts.length - minorCount

  // Every tag in use across the (platform-scoped) library, for the filter row.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of prompts) for (const t of p.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.keys()].sort()
  }, [prompts])

  const filtered = useMemo(() => {
    let list = platform === 'all' ? prompts : prompts.filter((p) => p.platform === platform)
    // Minor (filtered) prompts: when the filter is off (keepMinor) show
    // everything; otherwise "filtered" is a view toggle — show ONLY the hidden
    // minor prompts when peeking, ONLY the normal ones otherwise.
    if (!keepMinor) list = list.filter((p) => (showMinor ? p.minor : !p.minor))
    if (favoritesOnly) list = list.filter((p) => p.pinned ?? false)
    if (activeTags.length) {
      // AND: keep prompts that carry every active tag. Undefined tags → [].
      list = list.filter((p) => {
        const tags = p.tags ?? []
        return activeTags.every((t) => tags.includes(t))
      })
    }
    return list
  }, [prompts, platform, favoritesOnly, activeTags, keepMinor, showMinor])
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
    else if (sort === 'longest-unseen')
      list.sort((a, b) => (a.lastUsedAt ?? 0) - (b.lastUsedAt ?? 0))
    // 'newest' keeps listPrompts() order (already createdAt desc); search keeps relevance order
    return list
  }, [deferredQuery, filtered, index, sort])

  // `text` is the filled-in version when the prompt had blanks; usage still
  // counts against the original, since that's the prompt being reused.
  const onCopy = useCallback(async (p: Prompt, text?: string) => {
    try {
      await navigator.clipboard.writeText(text ?? p.text)
      if (p.id) await touchUsage(p.id)
    } catch {
      /* clipboard write can reject without document focus — no-op */
    }
  }, [])

  const onDelete = useCallback(
    async (p: Prompt) => {
      if (!p.id) return
      const id = p.id
      // A new delete ends the previous Undo window — finalize those rows now.
      window.clearTimeout(undoTimer.current)
      if (undoId != null) void finalizeSoftDelete(undoId)
      if (undoBatch) void finalizeSoftDeletes(undoBatch)
      await softDelete(id)
      setUndoBatch(null)
      setUndoId(id)
      // After Undo expires, erase for real — no forever tombstone.
      undoTimer.current = window.setTimeout(() => {
        void finalizeSoftDelete(id)
        setUndoId((cur) => (cur === id ? null : cur))
      }, DELETE_UNDO_MS)
      reload()
    },
    [reload, undoId, undoBatch],
  )

  const onUndoDelete = useCallback(async () => {
    if (undoId == null) return
    window.clearTimeout(undoTimer.current)
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

  const onKeepMinor = useCallback(
    async (p: Prompt) => {
      if (!p.id) return
      await setMinor(p.id, false)
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

  // Ids in the current list (filters + search). Select all / counts use this set.
  const selectableIds = useMemo(
    () => visible.map((p) => p.id).filter((id): id is number => id != null),
    [visible],
  )
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => checkedIds.has(id))

  const selectAllVisible = useCallback(() => {
    setCheckedIds(new Set(selectableIds))
  }, [selectableIds])

  const clearSelection = useCallback(() => {
    setCheckedIds(new Set())
  }, [])

  // Drop checks that fell out of the current view (filter/search changed).
  useEffect(() => {
    if (!selecting) return
    const allowed = new Set(selectableIds)
    setCheckedIds((prev) => {
      let changed = false
      const next = new Set<number>()
      for (const id of prev) {
        if (allowed.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [selecting, selectableIds])

  const onBulkDelete = useCallback(async () => {
    const ids = [...checkedIds]
    if (!ids.length) return
    window.clearTimeout(undoTimer.current)
    if (undoId != null) void finalizeSoftDelete(undoId)
    if (undoBatch) void finalizeSoftDeletes(undoBatch)
    await bulkSoftDelete(ids)
    setUndoId(null)
    setUndoBatch(ids)
    undoTimer.current = window.setTimeout(() => {
      void finalizeSoftDeletes(ids)
      setUndoBatch((cur) =>
        cur && cur.length === ids.length && cur.every((id, i) => id === ids[i]) ? null : cur,
      )
    }, DELETE_UNDO_MS)
    exitSelecting()
    reload()
  }, [checkedIds, reload, exitSelecting, undoId, undoBatch])

  const onUndoBatch = useCallback(async () => {
    if (!undoBatch) return
    window.clearTimeout(undoTimer.current)
    await bulkRestore(undoBatch)
    setUndoBatch(null)
    reload()
  }, [undoBatch, reload])

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  // Catch tombstones left behind if the page closed mid-Undo window.
  useEffect(() => {
    void purgeExpiredDeleted()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            <span className="tabular-nums">{shownCount}</span>{' '}
            {shownCount === 1 ? 'prompt' : 'prompts'}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
            <LockIcon size={11} className="shrink-0 text-ink-faint" />
            Safe on this device
          </p>
        </div>
        <CaptureHealthBadge onOpenSettings={onOpenSettings} />
      </header>

      {/* Find tools — search + filter as one stuck well; hairline before list. */}
      <div className="dj-find-tools">
        <div className="dj-find-tools-well">
          <div className="dj-search">
            <SearchIcon size={15} className="dj-search-icon" />
            <input
              type="search"
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
                <CloseIcon size={13} />
              </button>
            )}
          </div>

          {prompts.length > 0 && (
            <details className="dj-filter group">
              <summary className="dj-filter-summary">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="text-sm font-medium">Filter &amp; sort</span>
                  {filterActiveCount > 0 && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                      {filterActiveCount} active
                    </span>
                  )}
                </span>
                <ChevronIcon
                  size={14}
                  className="shrink-0 text-ink-faint transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="dj-filter-body">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    {multiPlatform && (
                      <div>
                        <p className="dj-filter-label">From</p>
                        <div
                          className="flex flex-wrap gap-1.5"
                          role="tablist"
                          aria-label="Filter by platform"
                        >
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
                      </div>
                    )}

                    <div>
                      <p className="dj-filter-label">Show</p>
                      <button
                        role="switch"
                        aria-checked={favoritesOnly}
                        aria-label="Show favorites only"
                        onClick={() => setFavoritesOnly((v) => !v)}
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                          favoritesOnly
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line bg-bg text-ink-soft hover:bg-sunk'
                        }`}
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
                        <FavoriteIcon filled={favoritesOnly} size={12} />
                        Favorites only
                      </button>
                    </div>
                  </div>

                  <div className="sm:w-48">
                    <p className="dj-filter-label">Sort by</p>
                    <div className="relative">
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as Sort)}
                        aria-label="Sort prompts"
                        className="dj-input w-full appearance-none py-1.5 pr-8 text-xs"
                      >
                        {SORTS.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <ChevronIcon
                        size={12}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                      />
                    </div>
                  </div>
                </div>

                {allTags.length > 0 && (
                  <div>
                    <p className="dj-filter-label">Tags</p>
                    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter by tag">
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
                          className="dj-btn dj-btn-ghost px-2 py-0.5 text-[11px]"
                        >
                          Clear tags
                        </button>
                      )}
                    </div>
                    {activeTags.length > 0 && (
                      <p className="dj-meta mt-1.5">
                        Showing prompts with every tag you&apos;ve picked.
                      </p>
                    )}
                  </div>
                )}

                {(!selecting || (!keepMinor && minorCount > 0)) && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {!selecting && (
                      <button
                        type="button"
                        onClick={() => setSelecting(true)}
                        className="dj-btn dj-btn-ghost px-2 py-1 text-xs"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="2" y="2" width="5" height="5" rx="1" />
                          <rect x="9" y="2" width="5" height="5" rx="1" />
                          <path d="M2.5 11.5h5M11 9.5l1 1.5 2.5-3" />
                        </svg>
                        Select a few
                      </button>
                    )}
                    {!keepMinor && minorCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowMinor((v) => !v)}
                        aria-pressed={showMinor}
                        title="Short one-offs Deja used to hide instead of skipping — keep or delete them"
                        className={`dj-btn dj-btn-ghost px-2 py-1 text-xs ${
                          showMinor ? 'text-ink' : 'text-ink-faint'
                        }`}
                      >
                        {showMinor ? 'Hide short ones' : `Short ones (${minorCount})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>

      {selecting && (
        <div
          role="region"
          aria-label="Selecting prompts"
          className="dj-enter-fast sticky top-0 z-10 flex flex-col gap-3 rounded-card border border-accent/30 bg-accent-soft px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              <span className="tabular-nums">{checkedIds.size}</span>
              <span className="font-normal text-ink-soft">
                {' '}
                of <span className="tabular-nums">{selectableIds.length}</span>
              </span>{' '}
              selected
            </p>
            <p className="dj-meta mt-0.5">
              Tick the ones to remove. You can undo for a few seconds after.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={allVisibleSelected ? clearSelection : selectAllVisible}
              disabled={selectableIds.length === 0}
              className="dj-btn dj-btn-ghost px-2.5 py-1.5 text-xs disabled:opacity-40"
            >
              {allVisibleSelected ? 'Clear selection' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={checkedIds.size === 0}
              className="dj-btn px-2.5 py-1.5 text-xs hover:border-danger hover:text-danger disabled:opacity-40"
            >
              {checkedIds.size === 0
                ? 'Delete'
                : `Delete ${checkedIds.size} ${checkedIds.size === 1 ? 'prompt' : 'prompts'}`}
            </button>
            <button
              type="button"
              onClick={exitSelecting}
              aria-label="Stop selecting"
              title="Stop selecting"
              className="dj-btn dj-btn-ghost p-1.5"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {undoId != null && (
        <div className="dj-enter-fast flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line bg-sunk px-3 py-2 text-sm">
          <span className="min-w-0 text-ink-soft">Prompt deleted — you can undo if that was a slip.</span>
          <button onClick={onUndoDelete} className="dj-btn dj-btn-ghost shrink-0 px-2 py-1 text-xs">
            Undo
          </button>
        </div>
      )}

      {undoBatch != null && (
        <div className="dj-enter-fast flex flex-wrap items-center justify-between gap-2 rounded-btn border border-line bg-sunk px-3 py-2 text-sm">
          <span className="min-w-0 text-ink-soft">
            {undoBatch.length} {undoBatch.length === 1 ? 'prompt' : 'prompts'} deleted.
          </span>
          <button onClick={onUndoBatch} className="dj-btn dj-btn-ghost shrink-0 px-2 py-1 text-xs">
            Undo
          </button>
        </div>
      )}

      <div className="dj-stagger flex flex-col gap-3">
        {loading ? (
          <SkeletonList count={4} />
        ) : loadError && prompts.length === 0 ? (
          <ErrorRetry onRetry={reload} />
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-sm">
            {prompts.length === 0 ? (
              <div className="flex flex-col gap-8">
                <div>
                  <p className="text-ink">Nothing here yet — take your time 🌱</p>
                  <p className="mt-1 text-ink-faint">
                    Ask ChatGPT, Claude, Gemini, DeepSeek, or Grok something the way you always do,
                    and it&apos;ll show up here on its own. Or borrow one of the starters below if
                    you&apos;d like a gentle first try.
                  </p>
                </div>
                <StarterPrompts />
              </div>
            ) : (
              <p className="text-ink-faint">
                Nothing matched that. Try another word, or clear a filter — you&apos;re fine.
              </p>
            )}
          </div>
        ) : (
          visible.map((p, i) => (
            <div key={p.id} style={{ ['--i' as string]: Math.min(i, 7) }}>
              <PromptCard
                prompt={p}
                onCopy={onCopy}
                onDelete={selecting ? undefined : onDelete}
                onTogglePin={selecting ? undefined : onTogglePin}
                onAddTag={selecting ? undefined : onAddTag}
                onRemoveTag={selecting ? undefined : onRemoveTag}
                onTagClick={onTagClick}
                onKeepMinor={selecting ? undefined : onKeepMinor}
                activeTags={activeTags}
                selectable={selecting}
                checked={p.id != null && checkedIds.has(p.id)}
                onToggleCheck={onToggleCheck}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
