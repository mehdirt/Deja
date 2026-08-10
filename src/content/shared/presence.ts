import { DEFAULT_PREFS, onPrefsChange, readPrefs, writePrefs, type Prefs } from '@/lib/prefs'
import { isBlocked } from '@/lib/blocklist'
import { relativeTime } from '@/lib/format'
import { safeCaptureUrl } from '@/lib/sensitive'
import {
  PLATFORM_COLOR,
  PLATFORM_LABEL,
  type LibraryRow,
  type LibrarySearchResponse,
  type Platform,
} from '@/lib/types'
import { anchorTo, rectOf, watchAnchor } from './anchor'
import { getBlocklist } from './blocklist'
import { captureState, surfacesAllowed } from './captureGate'
import { readText, replaceComposerText } from './editable'
import { BLANKS_CSS, hasBlanks, renderBlanks } from './blanks'
import { createOverlayHost, isRealUserEvent } from './overlayTheme'
import { showActionToast, showSavedToast } from './toast'

// The ambient dot — a small, quiet Deja button anchored to the chat box, and
// the panel it opens.
//
// WHY IT EXISTS. Before this, Deja was invisible unless the similarity
// threshold happened to fire. Someone could use it for a week and see nothing,
// which is how a passive extension gets forgotten (ROADMAP Phase 6 names this
// as the failure mode). A steady, low-contrast presence makes it discoverable
// without ever asking for attention: no idle animation, no pulses, no badge
// unless there's something real to say.
//
// The dot is also where "not here" lives (never save from this site, pause for
// an hour). Those controls already existed in settings; putting them at the
// moment of annoyance is the point.

const DEBUG = false
const PANEL_LIMIT = 6
// Show placeholder rows only if the worker is actually slow to answer. A cold
// MV3 worker takes a moment; a warm one answers in ~20ms, and flashing
// skeletons for that long reads as a bug rather than as loading.
const SKELETON_AFTER_MS = 120
const SEARCH_DEBOUNCE_MS = 120

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja:presence]', ...args)
}

/** What the dot is currently saying. Exactly one at a time. */
export type DotState = 'idle' | 'matches' | 'off' | 'broken'

/**
 * Which state wins when more than one applies.
 *
 * `off` beats `broken` on purpose: "we're not saving because you said so" and
 * "we're not saving because the site moved" are different messages, and showing
 * the alarming one when the user is the reason would be a small lie.
 */
export function pickDotState(opts: {
  saving: 'on' | 'paused' | 'site-off'
  broken: boolean
  matches: number
}): DotState {
  if (opts.saving !== 'on') return 'off'
  if (opts.broken) return 'broken'
  if (opts.matches > 0) return 'matches'
  return 'idle'
}

const MARK_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
<rect width="32" height="32" rx="8" fill="#5b54f0"/>
<rect x="7" y="7" width="13" height="13" rx="3.5" fill="#fff" opacity=".4"/>
<rect x="12" y="12" width="13" height="13" rx="3.5" fill="#fff" opacity=".95"/>
<rect x="15" y="17" width="2.4" height="3.6" rx=".6" fill="#5b54f0"/></svg>`

const PRESENCE_CSS = `
.dj-dot{position:fixed;pointer-events:auto;width:26px;height:26px;border-radius:50%;
  border:1px solid var(--dj-line);background:var(--dj-card);cursor:pointer;padding:0;
  display:grid;place-items:center;opacity:.55;
  transition:opacity .2s ease,box-shadow .2s ease,border-color .2s ease}
.dj-dot[hidden]{display:none}
.dj-dot:hover{opacity:1}
.dj-dot:focus-visible{opacity:1;outline:2px solid var(--dj-accent);outline-offset:2px}
.dj-dot svg{width:15px;height:15px;border-radius:4px;display:block}
.dj-dot[data-state="matches"]{opacity:1;border-color:var(--dj-accent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dj-accent) 16%,transparent)}
.dj-dot[data-state="broken"]{opacity:1;border-color:var(--dj-warn);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dj-warn) 20%,transparent)}
.dj-dot[data-state="off"]{opacity:.4;filter:grayscale(1)}
.dj-badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 4px;
  border-radius:999px;background:var(--dj-accent);color:#fff;font-size:10px;font-weight:700;
  line-height:16px;text-align:center;font-variant-numeric:tabular-nums}
.dj-badge[hidden]{display:none}
.dj-badge-warn{background:var(--dj-warn)}

.dj-panel{position:fixed;width:340px;max-width:calc(100vw - 16px);
  display:flex;flex-direction:column;overflow:hidden;padding:0}
.dj-panel[hidden]{display:none}
.dj-panel-head{display:flex;align-items:center;gap:8px;padding:9px 11px;
  border-bottom:1px solid var(--dj-line)}
.dj-panel-title{flex:1;min-width:0;font-size:12px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dj-search{width:100%;border:none;border-bottom:1px solid var(--dj-line);
  background:var(--dj-sunk);padding:9px 12px;font:inherit;font-size:13px;color:var(--dj-text)}
.dj-search:focus{outline:none;background:var(--dj-surface);border-bottom-color:var(--dj-accent)}
.dj-search::placeholder{color:var(--dj-text-faint)}
.dj-list{list-style:none;margin:0;padding:5px;max-height:232px;overflow-y:auto}
.dj-row{width:100%;display:block;text-align:left;border:none;background:none;cursor:pointer;
  padding:8px 9px;border-radius:8px;color:inherit;font:inherit}
.dj-row:hover,.dj-row[data-active="true"]{background:var(--dj-accent-soft)}
.dj-row-text{font-size:12.5px;line-height:1.45;color:var(--dj-text);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dj-row-text b{font-family:var(--dj-mono);font-weight:500;font-size:.92em;color:var(--dj-accent-text)}
.dj-row-meta{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:10.5px;
  color:var(--dj-text-faint);font-variant-numeric:tabular-nums}
.dj-plat{display:inline-flex;align-items:center;gap:4px}
.dj-plat i{width:7px;height:7px;border-radius:50%;display:block;
  box-shadow:inset 0 0 0 1px var(--dj-line)}
.dj-note{padding:16px 12px;font-size:12.5px;color:var(--dj-text-faint);text-align:center}
.dj-skel{padding:8px 9px}
.dj-skel-bar{height:9px;border-radius:5px;background:var(--dj-sunk);margin-bottom:6px}
.dj-skel-bar:last-child{width:55%;margin-bottom:0}
.dj-more{width:100%;text-align:left;padding:8px 9px;border-radius:8px;border:none;
  background:none;cursor:pointer;font:inherit;font-size:12px;font-weight:600;
  color:var(--dj-accent-text)}
.dj-more:hover{background:var(--dj-accent-soft)}
.dj-foot{border-top:1px solid var(--dj-line);padding:6px;display:flex;flex-direction:column;
  gap:2px;background:var(--dj-sunk)}
.dj-foot[hidden]{display:none}
.dj-foot-btn{display:flex;align-items:center;gap:6px;width:100%;text-align:left;border:none;
  background:none;cursor:pointer;padding:7px 9px;border-radius:8px;font:inherit;font-size:12px;
  color:var(--dj-text-soft)}
.dj-foot-btn:hover{background:var(--dj-card);color:var(--dj-text)}
.dj-broken{padding:12px;display:flex;flex-direction:column;gap:9px}
.dj-broken h4{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px}
.dj-broken h4 i{width:8px;height:8px;border-radius:50%;background:var(--dj-warn);flex:none}
.dj-broken p{margin:0;font-size:12px;line-height:1.5;color:var(--dj-text-soft)}
.dj-broken-draft{font-size:12px;line-height:1.5;background:var(--dj-sunk);border-radius:8px;
  padding:8px 10px;color:var(--dj-text-soft);max-height:64px;overflow:hidden}
` + BLANKS_CSS

interface PresenceOptions {
  /** Called when a prompt is inserted, so the caller can hide its own UI. */
  onInsert?: () => void
}

/**
 * Mount the dot (and its panel) for one page. Returns a teardown.
 *
 * `setMatchCount` on the returned handle is how the resurface layer feeds the
 * badge — deliberately, so the dot costs no extra queries: resurface is already
 * running one debounced SIMILAR_QUERY per pause in typing, and its response
 * already carries the total.
 */
export interface PresenceHandle {
  setMatchCount: (n: number) => void
  setBroken: (broken: boolean) => void
  destroy: () => void
}

export function attachPresence(
  getInput: () => HTMLElement | null,
  platform: Platform,
  options: PresenceOptions = {},
): PresenceHandle {
  let prefs: Prefs = { ...DEFAULT_PREFS }
  let matchCount = 0
  let broken = false
  let panelOpen = false
  let mounted = false
  let searchTimer: number | undefined
  let skeletonTimer: number | undefined
  let requestToken = 0

  const layer = createOverlayHost('presence', PRESENCE_CSS)

  // ── elements ──────────────────────────────────────────────────────────────
  const dot = document.createElement('button')
  dot.type = 'button'
  dot.className = 'dj-dot'
  dot.hidden = true
  dot.innerHTML = MARK_SVG
  const badge = document.createElement('span')
  badge.className = 'dj-badge'
  badge.hidden = true
  dot.appendChild(badge)

  const panel = document.createElement('div')
  panel.className = 'dj-card dj-panel'
  panel.hidden = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Your saved prompts')

  const head = document.createElement('div')
  head.className = 'dj-panel-head'
  const title = document.createElement('span')
  title.className = 'dj-panel-title'
  title.textContent = 'Your saved prompts'
  // A real close button, not just Escape. Most people here are mouse-first and
  // the panel traps focus while it's open — leaving them only a keyboard exit
  // would strand exactly the audience Deja is for.
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'dj-btn dj-x'
  closeBtn.textContent = '×'
  closeBtn.setAttribute('aria-label', 'Close')
  head.append(title, closeBtn)

  const body = document.createElement('div')

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'dj-search'
  search.placeholder = 'Search what you’ve saved…'
  search.setAttribute('aria-label', 'Search what you’ve saved')

  const list = document.createElement('ul')
  list.className = 'dj-list'

  const foot = document.createElement('div')
  foot.className = 'dj-foot'

  const offBtn = document.createElement('button')
  offBtn.type = 'button'
  offBtn.className = 'dj-foot-btn'

  const pauseBtn = document.createElement('button')
  pauseBtn.type = 'button'
  pauseBtn.className = 'dj-foot-btn'

  foot.append(offBtn, pauseBtn)
  body.append(search, list, foot)

  // Alternate views the panel can show instead of the list.
  const fillView = document.createElement('div')
  fillView.hidden = true
  const brokenView = document.createElement('div')
  brokenView.hidden = true

  panel.append(head, body, fillView, brokenView)
  layer.shadow.append(dot, panel)

  // ── state ─────────────────────────────────────────────────────────────────

  const savingState = (): 'on' | 'paused' | 'site-off' => {
    const s = captureState()
    return s === 'incognito' ? 'site-off' : s
  }

  /** Is this page one where Deja operates at all? */
  const allowedHere = (): boolean => {
    if (!prefs.inPageDot) return false
    if (!surfacesAllowed()) return false
    // A domain the user named in "never save from…" is somewhere Deja does not
    // operate, full stop — not somewhere it reads quietly. Text is empty here
    // because we're asking about the page, not about a particular prompt.
    if (isBlocked(location.href, '', getBlocklist())) return false
    return true
  }

  const paint = () => {
    if (!allowedHere()) {
      dot.hidden = true
      if (panelOpen) closePanel()
      return
    }
    dot.hidden = false
    const state = pickDotState({ saving: savingState(), broken, matches: matchCount })
    dot.setAttribute('data-state', state)

    badge.classList.toggle('dj-badge-warn', state === 'broken')
    if (state === 'matches') {
      badge.hidden = false
      badge.textContent = String(matchCount)
      dot.setAttribute(
        'aria-label',
        `Deja — ${matchCount} saved ${matchCount === 1 ? 'prompt looks' : 'prompts look'} like this`,
      )
    } else if (state === 'broken') {
      badge.hidden = false
      badge.textContent = '!'
      dot.setAttribute('aria-label', 'Deja can’t see this box right now')
    } else if (state === 'off') {
      badge.hidden = true
      dot.setAttribute(
        'aria-label',
        savingState() === 'paused' ? 'Deja — saving paused' : 'Deja — not saving on this site',
      )
    } else {
      badge.hidden = true
      dot.setAttribute('aria-label', 'Deja — your saved prompts')
    }

    // Footer copy follows the current state: offering "pause" to someone who is
    // already paused would be nonsense.
    const s = savingState()
    offBtn.replaceChildren()
    if (s === 'site-off') {
      offBtn.append(document.createTextNode('Start saving here again'))
    } else {
      offBtn.append(document.createTextNode('Not here — never save from '))
      const hostSpan = document.createElement('span')
      hostSpan.className = 'dj-mono'
      hostSpan.textContent = location.hostname
      offBtn.appendChild(hostSpan)
    }
    pauseBtn.textContent = s === 'paused' ? 'Resume saving now' : 'Pause saving for an hour'

    position()
  }

  const position = () => {
    const rect = rectOf(getInput())
    if (!rect) {
      dot.hidden = true
      if (panelOpen) closePanel()
      return
    }
    // Outside the composer's right edge first. Every supported site puts its own
    // send button inside the bottom-right of the box; overlapping it would be
    // the fastest possible way to make someone uninstall.
    anchorTo(dot, rect, 'right-outside', 8)
    if (panelOpen) anchorTo(panel, rect, 'above', 9)
  }

  // ── the list ──────────────────────────────────────────────────────────────

  const showNote = (text: string) => {
    list.replaceChildren()
    const li = document.createElement('li')
    const note = document.createElement('div')
    note.className = 'dj-note'
    note.textContent = text
    li.appendChild(note)
    list.appendChild(li)
  }

  const showSkeleton = () => {
    list.replaceChildren()
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li')
      li.className = 'dj-skel'
      li.setAttribute('aria-hidden', 'true')
      const a = document.createElement('div')
      a.className = 'dj-skel-bar'
      const b = document.createElement('div')
      b.className = 'dj-skel-bar'
      li.append(a, b)
      list.appendChild(li)
    }
  }

  const rowFor = (row: LibraryRow): HTMLLIElement => {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'dj-row'

    const text = document.createElement('div')
    text.className = 'dj-row-text'
    text.textContent = row.text.replace(/\s+/g, ' ').trim()

    const meta = document.createElement('div')
    meta.className = 'dj-row-meta'
    const plat = document.createElement('span')
    plat.className = 'dj-plat'
    const swatch = document.createElement('i')
    swatch.style.background = PLATFORM_COLOR[row.platform]
    plat.append(swatch, document.createTextNode(PLATFORM_LABEL[row.platform]))
    meta.appendChild(plat)
    meta.appendChild(document.createTextNode('·'))
    meta.appendChild(document.createTextNode(relativeTime(row.lastUsedAt)))
    if (row.usageCount > 0) {
      meta.appendChild(document.createTextNode('·'))
      meta.appendChild(document.createTextNode(`used ${row.usageCount}×`))
    }

    btn.append(text, meta)
    btn.addEventListener('mousedown', (e) => e.preventDefault())
    btn.addEventListener('click', () => choose(row))
    li.appendChild(btn)
    return li
  }

  const renderRows = (rows: LibraryRow[], total: number, query: string) => {
    if (!rows.length) {
      showNote(query ? 'Nothing here matches that yet.' : 'Nothing saved yet — that’s normal.')
      return
    }
    list.replaceChildren()
    for (const row of rows) list.appendChild(rowFor(row))
    // Never silently cap someone's library at six rows with nowhere to go.
    if (total > rows.length) {
      const li = document.createElement('li')
      const more = document.createElement('button')
      more.type = 'button'
      more.className = 'dj-more'
      more.textContent = `See all ${total} in your library →`
      more.addEventListener('mousedown', (e) => e.preventDefault())
      more.addEventListener('click', () => {
        send({ type: 'OPEN_LIBRARY', query })
        closePanel()
      })
      li.appendChild(more)
      list.appendChild(li)
    }
  }

  const runSearch = (query: string) => {
    const token = ++requestToken
    window.clearTimeout(skeletonTimer)
    skeletonTimer = window.setTimeout(() => {
      if (token === requestToken) showSkeleton()
    }, SKELETON_AFTER_MS)

    send<LibrarySearchResponse>({ type: 'LIBRARY_SEARCH', query, limit: PANEL_LIMIT })
      .then((resp) => {
        if (token !== requestToken) return // a later keystroke won
        window.clearTimeout(skeletonTimer)
        if (!resp?.ok) {
          showNote('Couldn’t reach your library just now.')
          return
        }
        renderRows(resp.rows, resp.total, query)
        position()
      })
      .catch(() => {
        window.clearTimeout(skeletonTimer)
        showNote('Couldn’t reach your library just now.')
      })
  }

  // ── choosing a prompt ─────────────────────────────────────────────────────

  const insert = (text: string, id: number) => {
    const el = getInput()
    const wrote = prefs.resurfaceClick === 'insert' && el && replaceComposerText(el, text)
    if (!wrote) {
      try {
        void navigator.clipboard?.writeText(text)?.catch(() => {})
      } catch {
        /* clipboard unavailable — never disturb the host page */
      }
    }
    void send({ type: 'PROMPT_USED', id })
    closePanel()
    options.onInsert?.()
    el?.focus()
  }

  const choose = (row: LibraryRow) => {
    if (hasBlanks(row.text)) {
      showView('fill')
      title.textContent = 'Fill in the blanks'
      const handle = renderBlanks(fillView, {
        text: row.text,
        onDone: (filled) => insert(filled, row.id),
        onCancel: () => {
          title.textContent = 'Your saved prompts'
          showView('list')
          search.focus()
        },
      })
      position()
      handle.focus()
      return
    }
    insert(row.text, row.id)
  }

  // ── panel open/close ──────────────────────────────────────────────────────

  const showView = (which: 'list' | 'fill' | 'broken') => {
    body.hidden = which !== 'list'
    fillView.hidden = which !== 'fill'
    brokenView.hidden = which !== 'broken'
  }

  function openPanel() {
    if (!allowedHere()) return
    panelOpen = true
    panel.hidden = false
    if (broken) {
      title.textContent = 'Deja'
      renderBroken()
      showView('broken')
    } else {
      title.textContent = 'Your saved prompts'
      showView('list')
      search.value = ''
      showSkeleton()
      runSearch('')
    }
    foot.hidden = broken
    position()
    if (!broken) search.focus()
    else closeBtn.focus()
  }

  function closePanel() {
    if (!panelOpen) return
    panelOpen = false
    panel.hidden = true
    window.clearTimeout(searchTimer)
    window.clearTimeout(skeletonTimer)
    requestToken++
    title.textContent = 'Your saved prompts'
    showView('list')
  }

  const returnFocus = () => {
    try {
      getInput()?.focus()
    } catch {
      /* composer gone — nothing to focus */
    }
  }

  // ── the broken state (M5) ─────────────────────────────────────────────────

  function renderBroken() {
    brokenView.replaceChildren()
    const wrap = document.createElement('div')
    wrap.className = 'dj-broken'

    const h = document.createElement('h4')
    const marker = document.createElement('i')
    marker.setAttribute('aria-hidden', 'true')
    h.append(marker, document.createTextNode('Deja can’t see this box right now'))
    wrap.appendChild(h)

    const p = document.createElement('p')
    p.textContent =
      'This site changed its layout, so nothing here is being saved. You can still keep this one.'
    wrap.appendChild(p)

    const el = getInput()
    const draft = el ? readText(el).trim() : ''
    if (!draft) {
      const hint = document.createElement('p')
      hint.textContent = 'Type something first and this will offer to keep it.'
      wrap.appendChild(hint)
      brokenView.appendChild(wrap)
      return
    }

    const preview = document.createElement('div')
    preview.className = 'dj-broken-draft'
    preview.textContent = draft
    wrap.appendChild(preview)

    const actions = document.createElement('div')
    actions.className = 'dj-fill-actions'
    const save = document.createElement('button')
    save.type = 'button'
    save.className = 'dj-mini dj-mini-primary'
    save.textContent = 'Save this one by hand'
    save.addEventListener('mousedown', (e) => e.preventDefault())
    save.addEventListener('click', () => {
      // A write, so unlike reading it stays blocked whenever saving is off.
      if (savingState() !== 'on') return
      closePanel()
      returnFocus()
      send<{ ok: boolean; id?: number }>({
        type: 'SAVE_MANUAL',
        text: draft,
        platform,
        url: safeCaptureUrl(location.href),
      })
        .then((resp) => {
          if (!resp?.ok || resp.id == null) return
          const id = resp.id
          showSavedToast(() => void send({ type: 'UNDO_CAPTURE', id }), 'kept by hand')
        })
        .catch(() => {
          /* worker asleep — fail silently, never disturb the host page */
        })
    })
    actions.appendChild(save)
    wrap.appendChild(actions)
    brokenView.appendChild(wrap)
  }

  // ── wiring ────────────────────────────────────────────────────────────────

  dot.addEventListener('mousedown', (e) => e.preventDefault())
  dot.addEventListener('click', (e) => {
    // Only a real person may open a surface that reads the library. A page
    // script can forge a click; it can't forge isTrusted.
    if (!isRealUserEvent(e)) return
    if (panelOpen) {
      closePanel()
      returnFocus()
    } else {
      openPanel()
    }
  })

  closeBtn.addEventListener('mousedown', (e) => e.preventDefault())
  closeBtn.addEventListener('click', () => {
    closePanel()
    returnFocus()
  })

  search.addEventListener('input', () => {
    window.clearTimeout(searchTimer)
    const q = search.value
    searchTimer = window.setTimeout(() => runSearch(q.trim()), SEARCH_DEBOUNCE_MS)
  })

  offBtn.addEventListener('mousedown', (e) => e.preventDefault())
  offBtn.addEventListener('click', () => {
    const turningOff = savingState() !== 'site-off'
    void writePrefs({ sites: { ...prefs.sites, [platform]: !turningOff } })
    closePanel()
    returnFocus()
    showActionToast(
      turningOff
        ? `Deja won’t save from ${location.hostname} any more.`
        : `Saving again on ${location.hostname}.`,
      'Undo',
      () => void writePrefs({ sites: { ...prefs.sites, [platform]: turningOff } }),
    )
  })

  pauseBtn.addEventListener('mousedown', (e) => e.preventDefault())
  pauseBtn.addEventListener('click', () => {
    const resuming = savingState() === 'paused'
    const previous = prefs.pauseUntil
    void writePrefs({ pauseUntil: resuming ? 0 : Date.now() + 60 * 60 * 1000 })
    closePanel()
    returnFocus()
    showActionToast(
      resuming ? 'Saving again.' : 'Saving paused for an hour. It comes back on its own.',
      resuming ? 'Undo' : 'Resume now',
      () => void writePrefs({ pauseUntil: resuming ? previous : 0 }),
    )
  })

  // Escape closes; clicking anywhere outside closes. Both return focus to the
  // composer so the person is exactly where they were.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && panelOpen) {
      e.stopPropagation()
      closePanel()
      returnFocus()
    }
  }
  const onDocPointerDown = (e: Event) => {
    if (!panelOpen) return
    const path = e.composedPath?.() ?? []
    if (path.includes(panel) || path.includes(dot)) return
    closePanel()
  }
  // Keep focus inside the panel while it's open (it's a dialog), but never
  // steal focus back from the host page once it's closed.
  const onFocusIn = (e: FocusEvent) => {
    if (!panelOpen) return
    const path = e.composedPath?.() ?? []
    if (path.includes(panel)) return
    // The composer legitimately keeps focus for insert-at-cursor to work.
    const el = getInput()
    if (el && path.includes(el)) return
    closePanel()
  }

  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('focusin', onFocusIn, true)
  const unwatch = watchAnchor(() => rectOf(getInput()), position)

  const unsubPrefs = onPrefsChange((p) => {
    prefs = p
    paint()
  })

  void readPrefs()
    .then((p) => {
      prefs = p
    })
    .catch(() => {
      /* keep defaults — fail open, same as the capture gate */
    })
    .finally(() => {
      mounted = true
      paint()
    })

  // A slow re-check so the dot follows a composer that renders late or moves
  // (SPA route changes are the common case). Cheap: one rect read.
  const tick = window.setInterval(() => {
    if (mounted) paint()
  }, 2000)

  log('armed for', platform)

  return {
    setMatchCount(n: number) {
      const next = Math.max(0, n | 0)
      if (next === matchCount) return
      matchCount = next
      paint()
    },
    setBroken(next: boolean) {
      if (next === broken) return
      broken = next
      paint()
    },
    destroy() {
      window.clearInterval(tick)
      window.clearTimeout(searchTimer)
      window.clearTimeout(skeletonTimer)
      unsubPrefs()
      unwatch()
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      layer.destroy()
    },
  }
}

/** sendMessage that never throws into the host page. */
function send<T = unknown>(message: unknown): Promise<T | undefined> {
  if (!chrome.runtime?.id) return Promise.resolve(undefined)
  try {
    return chrome.runtime.sendMessage(message).catch(() => undefined)
  } catch {
    return Promise.resolve(undefined)
  }
}
