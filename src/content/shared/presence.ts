import { DEFAULT_PREFS, onPrefsChange, readPrefs, writePrefs, type Prefs } from '@/lib/prefs'
import { isBlocked } from '@/lib/blocklist'
import { onHealthChange } from '@/lib/health'
import { isCapturableField, safeCaptureUrl } from '@/lib/sensitive'
import { type LibraryRow, type LibrarySearchResponse, type Platform } from '@/lib/types'
import { anchorTo, pickSpot, rectOf, watchAnchor, type DotCorner, type Spot } from './anchor'
import { getBlocklist, isBlocklistLoaded } from './blocklist'
import { captureState, surfacesAllowed } from './captureGate'
import { readText, replaceComposerText } from './editable'
import { BLANKS_CSS, hasBlanks, renderBlanks } from './blanks'
import { createOverlayHost, isRealUserEvent } from './overlayTheme'
import {
  LIBRARY_ROWS_CSS,
  renderNote,
  renderRow,
  renderSkeleton,
} from './libraryRows'
import { sendToWorker as send } from './message'
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
// Small enough to sit inside a message box without crowding the text, big
// enough to be a comfortable click target.
const DOT_SIZE = 26
const DOT_GAP = 8
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
<rect width="32" height="32" rx="8" fill="var(--dj-accent)"/>
<rect x="7" y="7" width="13" height="13" rx="3.5" fill="#fff" opacity=".4"/>
<rect x="12" y="12" width="13" height="13" rx="3.5" fill="#fff" opacity=".95"/>
<rect x="15" y="17" width="2.4" height="3.6" rx=".6" fill="var(--dj-accent)"/></svg>`

const SEARCH_SVG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
<circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/>
<path d="M10.5 10.5L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`

const CLOSE_SVG = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`

// Panel chrome mirrors the popup: brand header, rounded search well, card stack
// on paper, quiet footer. Same tokens as Library — denser, not different.
const PRESENCE_CSS = `
.dj-dot{position:fixed;pointer-events:auto;width:26px;height:26px;border-radius:9px;
  border:1px solid var(--dj-line);background:var(--dj-surface);cursor:pointer;padding:0;
  display:grid;place-items:center;opacity:.62;box-shadow:var(--dj-shadow-sm);
  transition:opacity .2s ease,box-shadow .2s ease,border-color .2s ease,transform .15s cubic-bezier(0.16,1,0.3,1)}
.dj-dot[hidden]{display:none}
.dj-dot:hover{opacity:1;transform:translateY(-1px);
  border-color:color-mix(in srgb,var(--dj-accent) 28%,var(--dj-line))}
.dj-dot:focus-visible{opacity:1;outline:2px solid var(--dj-accent);outline-offset:2px}
.dj-dot svg{width:15px;height:15px;border-radius:4px;display:block}
.dj-dot[data-state="matches"]{opacity:1;border-color:var(--dj-accent);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dj-accent) 16%,transparent),var(--dj-shadow-sm)}
.dj-dot[data-state="broken"]{opacity:1;border-color:var(--dj-warn);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dj-warn) 20%,transparent),var(--dj-shadow-sm)}
.dj-dot[data-state="off"]{opacity:.4;filter:grayscale(1)}
.dj-badge{position:absolute;min-width:15px;height:15px;padding:0 4px;
  border-radius:999px;background:var(--dj-accent);color:#fff;font-size:9.5px;font-weight:700;
  line-height:15px;text-align:center;font-variant-numeric:tabular-nums;
  box-shadow:0 0 0 1.5px var(--dj-surface);pointer-events:none}
.dj-badge[hidden]{display:none}
.dj-badge-warn{background:var(--dj-warn)}
.dj-dot[data-corner="bottom-right"] .dj-badge{top:-5px;left:-5px}
.dj-dot[data-corner="top-right"] .dj-badge{bottom:-5px;left:-5px}
.dj-dot[data-corner="top-left"] .dj-badge{bottom:-5px;right:-5px}
.dj-dot[data-corner="outside-right"] .dj-badge{top:-5px;right:-5px}

.dj-panel{position:fixed;width:372px;max-width:calc(100vw - 16px);
  display:flex;flex-direction:column;overflow:hidden;padding:0;
  border-radius:16px}
.dj-panel[hidden]{display:none}

/* Popup-style header: mark + wordmark, quiet close. */
.dj-panel-head{display:flex;align-items:center;gap:10px;padding:12px 14px;
  border-bottom:1px solid var(--dj-line);background:var(--dj-bg)}
.dj-panel-mark{width:22px;height:22px;border-radius:6px;flex:none;display:block}
.dj-panel-mark svg{width:22px;height:22px;display:block;border-radius:6px}
.dj-panel-brand{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.dj-wordmark{font-size:15px;font-weight:700;letter-spacing:-0.02em;line-height:1.1;color:var(--dj-text)}
.dj-wordmark .ja{color:var(--dj-accent-text)}
.dj-panel-title{font-size:13.5px;font-weight:600;letter-spacing:-0.015em;line-height:1.2;
  color:var(--dj-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dj-panel-sub{font-size:11px;color:var(--dj-text-faint);line-height:1.2}
.dj-close{flex:none;width:28px;height:28px;padding:0;border-radius:8px;color:var(--dj-text-faint);
  display:grid;place-items:center}
.dj-close svg{width:14px;height:14px;display:block}
.dj-close:hover{background:var(--dj-sunk);color:var(--dj-text)}

/* Search sits in a padded tools band — rounded well like popup/library. */
.dj-tools{padding:12px 14px 10px;background:var(--dj-bg);border-bottom:1px solid var(--dj-line)}
.dj-search-wrap{position:relative}
.dj-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);
  width:14px;height:14px;color:var(--dj-text-faint);pointer-events:none;display:block}
.dj-search-icon svg{width:14px;height:14px;display:block}
.dj-search{width:100%;border:1px solid var(--dj-line);border-radius:var(--dj-radius-btn);
  background:var(--dj-sunk);padding:10px 12px 10px 34px;font:inherit;font-size:13.5px;
  color:var(--dj-text);transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease}
.dj-search:focus{outline:none;background:var(--dj-surface);border-color:var(--dj-accent);
  box-shadow:0 0 0 1px var(--dj-accent)}
.dj-search::placeholder{color:var(--dj-text-faint)}
.dj-search::-webkit-search-cancel-button{appearance:none}

.dj-list{max-height:268px;background:var(--dj-bg);padding:10px 10px 8px;gap:8px}
.dj-more{width:100%;text-align:center;padding:10px 12px;border-radius:var(--dj-radius-btn);
  border:1px dashed color-mix(in srgb,var(--dj-accent) 28%,var(--dj-line));
  background:var(--dj-surface);cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;
  color:var(--dj-accent-text);transition:background-color .15s ease,border-color .15s ease}
.dj-more:hover{background:var(--dj-accent-soft);border-style:solid}

.dj-foot{border-top:1px solid var(--dj-line);padding:8px 10px;display:flex;gap:6px;
  background:var(--dj-surface)}
.dj-foot[hidden]{display:none}
.dj-foot-btn{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;
  text-align:center;border:1px solid var(--dj-line);background:var(--dj-bg);cursor:pointer;
  padding:7px 8px;border-radius:8px;font:inherit;font-size:11.5px;font-weight:500;
  color:var(--dj-text-soft);line-height:1.25;
  transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.dj-foot-btn:hover{background:var(--dj-sunk);color:var(--dj-text);
  border-color:color-mix(in srgb,var(--dj-accent) 18%,var(--dj-line))}
.dj-foot-btn .dj-mono{font-size:10.5px}

.dj-broken{padding:16px 16px 18px;display:flex;flex-direction:column;gap:11px;background:var(--dj-bg)}
.dj-broken h4{margin:0;font-size:14.5px;font-weight:600;letter-spacing:-0.015em;
  display:flex;align-items:center;gap:8px}
.dj-broken h4 i{width:8px;height:8px;border-radius:50%;background:var(--dj-warn);flex:none}
.dj-broken p{margin:0;font-size:13px;line-height:1.55;color:var(--dj-text-soft)}
.dj-broken-draft{font-size:13.5px;line-height:1.5;background:var(--dj-surface);border:1px solid var(--dj-line);
  border-radius:12px;padding:11px 13px;color:var(--dj-text-soft);max-height:76px;overflow:hidden;
  box-shadow:var(--dj-shadow-sm)}
` + LIBRARY_ROWS_CSS + BLANKS_CSS

interface PresenceOptions {
  /** Called when a prompt is inserted, so the caller can hide its own UI. */
  onInsert?: () => void
  /**
   * Pin the dot to a particular corner of the message box on this site.
   *
   * Placement is automatic by default and usually right. This exists for the
   * case where a site's own layout makes the automatic answer look wrong, and
   * it lives next to that site's selectors for the same reason they do: when a
   * site redesigns, everything that needs re-tuning is in one file. A pin is
   * still collision-checked, so it can never park the dot on a send button.
   */
  dotCorner?: DotCorner
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
  /** Re-evaluate visibility now (e.g. once the blocklist rules have loaded). */
  refresh: () => void
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
  const mark = document.createElement('span')
  mark.className = 'dj-panel-mark'
  mark.innerHTML = MARK_SVG
  mark.setAttribute('aria-hidden', 'true')
  const brand = document.createElement('div')
  brand.className = 'dj-panel-brand'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'dj-btn dj-close'
  closeBtn.innerHTML = CLOSE_SVG
  closeBtn.setAttribute('aria-label', 'Close')
  head.append(mark, brand, closeBtn)

  /** Home = mark + deja wordmark (like the popup). Other modes = plain title. */
  const paintHead = (mode: 'home' | 'fill' | 'broken') => {
    brand.replaceChildren()
    if (mode === 'home') {
      const word = document.createElement('span')
      word.className = 'dj-wordmark'
      word.innerHTML = 'de<span class="ja">ja</span>'
      const sub = document.createElement('span')
      sub.className = 'dj-panel-sub'
      sub.textContent = 'Your saved prompts'
      brand.append(word, sub)
      return
    }
    const title = document.createElement('span')
    title.className = 'dj-panel-title'
    title.textContent = mode === 'fill' ? 'Fill in the blanks' : 'Deja'
    brand.appendChild(title)
  }
  paintHead('home')

  const body = document.createElement('div')

  const tools = document.createElement('div')
  tools.className = 'dj-tools'
  const searchWrap = document.createElement('div')
  searchWrap.className = 'dj-search-wrap'
  const searchIcon = document.createElement('span')
  searchIcon.className = 'dj-search-icon'
  searchIcon.innerHTML = SEARCH_SVG
  searchIcon.setAttribute('aria-hidden', 'true')
  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'dj-search'
  search.placeholder = 'Find a prompt…'
  search.setAttribute('aria-label', 'Find a prompt')
  searchWrap.append(searchIcon, search)
  tools.appendChild(searchWrap)

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
  body.append(tools, list, foot)

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
    // Stay hidden until the rules have actually loaded: unlike capture, which
    // fails open because never saving is the worse outcome, a surface that
    // reads the library out onto the page must fail closed.
    if (!isBlocklistLoaded()) return false
    if (isBlocked(location.href, '', getBlocklist())) return false
    return true
  }

  // What the last paint rendered, so an idle tick can do nothing at all. The
  // dot lives on every supported page for the life of the tab; rebuilding its
  // footer and forcing a layout read twice a minute for no reason is exactly
  // the kind of ambient cost that makes an extension feel heavy.
  let painted = ''

  const paint = () => {
    if (!allowedHere()) {
      dot.hidden = true
      painted = ''
      if (panelOpen) closePanel()
      return
    }
    dot.hidden = false
    const saving = savingState()
    const state = pickDotState({ saving, broken, matches: matchCount })
    // Position still has to be re-checked (the composer moves), but the DOM
    // rebuild below only matters when what we're saying changed.
    const signature = `${state}|${saving}|${matchCount}`
    if (signature === painted && !panelOpen) {
      position()
      return
    }
    painted = signature
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

    // Footer stays short — detail lives in the undo toast after they click.
    const s = saving
    offBtn.replaceChildren()
    if (s === 'site-off') {
      offBtn.textContent = 'Save here again'
    } else {
      offBtn.textContent = 'Never save here'
    }
    pauseBtn.textContent = s === 'paused' ? 'Resume now' : 'Pause 1 hour'

    position()
  }

  // Is the host page already using this square for something of its own?
  //
  // elementFromPoint gives us the topmost element the *user* would hit there.
  // Our own layer is pointer-events:none, so we never find ourselves. Anything
  // clickable belonging to the site — its send button, an attach control, a
  // model picker — means "not here". Sampling the centre plus the corners
  // catches a control we'd only partly overlap.
  const isOccupied = (spot: Spot): boolean => {
    const pts: Array<[number, number]> = [
      [spot.left + DOT_SIZE / 2, spot.top + DOT_SIZE / 2],
      [spot.left + 2, spot.top + 2],
      [spot.left + DOT_SIZE - 2, spot.top + 2],
      [spot.left + 2, spot.top + DOT_SIZE - 2],
      [spot.left + DOT_SIZE - 2, spot.top + DOT_SIZE - 2],
    ]
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true
      let el: Element | null = null
      try {
        el = document.elementFromPoint(x, y)
      } catch {
        return false // can't tell — don't refuse the spot on that basis
      }
      if (!el) continue
      if (el.closest('button, a[href], [role="button"], input, select, [contenteditable="false"]')) {
        return true
      }
    }
    return false
  }

  const position = () => {
    // Host-page SPA navigations detach injected nodes; put ours back first.
    layer.reattach()
    const rect = rectOf(getInput())
    if (!rect) {
      dot.hidden = true
      if (panelOpen) closePanel()
      return
    }
    // Inside the box, hugging whichever corner the site isn't already using.
    // Inside is what makes it read as part of the message box rather than as
    // something floating near it.
    const spot = pickSpot(rect, DOT_SIZE, DOT_GAP, isOccupied, options.dotCorner)
    dot.style.position = 'fixed'
    dot.style.left = `${Math.round(spot.left)}px`
    dot.style.top = `${Math.round(spot.top)}px`
    dot.dataset.corner = spot.corner
    if (panelOpen) anchorTo(panel, rect, 'above', 9)
  }

  // ── the list ──────────────────────────────────────────────────────────────

  const note = (text: string) => renderNote(list, text)

  const renderRows = (rows: LibraryRow[], total: number, query: string) => {
    if (!rows.length) {
      note(
        query
          ? 'No matches this time — try a different word?'
          : 'Nothing saved yet — that’s normal. Ask something on this site and it’ll land here.',
      )
      return
    }
    list.replaceChildren()
    for (const row of rows) list.appendChild(renderRow(row, () => choose(row)))
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
      if (token === requestToken) renderSkeleton(list)
    }, SKELETON_AFTER_MS)

    send<LibrarySearchResponse>({ type: 'LIBRARY_SEARCH', query, limit: PANEL_LIMIT })
      .then((resp) => {
        if (token !== requestToken) return // a later keystroke won
        window.clearTimeout(skeletonTimer)
        if (!resp?.ok) {
          note('Couldn’t reach your library just now.')
          return
        }
        renderRows(resp.rows, resp.total, query)
        position()
      })
      .catch(() => {
        if (token !== requestToken) return
        window.clearTimeout(skeletonTimer)
        note('Couldn’t reach your library just now.')
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
      paintHead('fill')
      const handle = renderBlanks(fillView, {
        text: row.text,
        onDone: (filled) => insert(filled, row.id),
        onCancel: () => {
          paintHead('home')
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
      paintHead('broken')
      renderBroken()
      showView('broken')
    } else {
      paintHead('home')
      showView('list')
      search.value = ''
      renderSkeleton(list)
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
    paintHead('home')
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

    // Same eligibility rules the capture path applies: never read a field that
    // isn't a real composer (isCapturableField already refuses <input>,
    // password and OTP fields), and never offer to keep text a blocklist rule
    // says must not be stored. A hand-save is still a save.
    const el = getInput()
    const raw = el && isCapturableField(el) ? readText(el).trim() : ''
    const draft = raw && !isBlocked(location.href, raw, getBlocklist()) ? raw : ''
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
          showSavedToast(() => void send({ type: 'UNDO_CAPTURE', id }), {
            full: 'Kept this one by hand ✓',
          })
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
  // composer so the person is exactly where they were. During fill-in, Escape
  // matches the Back button instead of nuking the whole panel.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && panelOpen) {
      e.preventDefault()
      e.stopPropagation()
      if (!fillView.hidden) {
        paintHead('home')
        showView('list')
        search.focus()
        return
      }
      closePanel()
      returnFocus()
    }
  }
  // A closed shadow root is invisible to composedPath() at a document listener:
  // the path stops at the host element. Testing for `panel`/`dot` here would
  // always be false, so every click inside our own panel would close it. The
  // host is the only node we can legitimately recognise from out here.
  const withinOurSurface = (e: Event): boolean =>
    (e.composedPath?.() ?? []).includes(layer.host)

  const onDocPointerDown = (e: Event) => {
    if (!panelOpen) return
    if (withinOurSurface(e)) return
    closePanel()
  }
  // Keep focus inside the panel while it's open (it's a dialog), but never
  // steal focus back from the host page once it's closed.
  const onFocusIn = (e: FocusEvent) => {
    if (!panelOpen) return
    if (withinOurSurface(e)) return
    // The composer legitimately keeps focus for insert-at-cursor to work.
    const el = getInput()
    if (el && (e.composedPath?.() ?? []).includes(el)) return
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

  // The DOM probe tells us about selector drift through setBroken(). This
  // catches the other half: capture.ts also marks a platform unhealthy when the
  // message pipeline itself fails (worker error, storage rejection), and that
  // failure is just as invisible to the person typing.
  const unsubHealth = onHealthChange((health) => {
    const entry = health[platform]
    if (entry) {
      const next = entry.ok === false
      if (next !== broken) {
        broken = next
        paint()
      }
    }
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
    refresh() {
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
      unsubHealth()
      unwatch()
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      layer.destroy()
    },
  }
}

