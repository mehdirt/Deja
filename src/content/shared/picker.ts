import { DEFAULT_PREFS, onPrefsChange, readPrefs, type Prefs } from '@/lib/prefs'
import { isBlocked } from '@/lib/blocklist'
import { isCapturableField } from '@/lib/sensitive'
import { type LibraryRow, type LibrarySearchResponse, type Platform } from '@/lib/types'
import { anchorTo, rectOf, watchAnchor } from './anchor'
import { getBlocklist, isBlocklistLoaded } from './blocklist'
import { surfacesAllowed } from './captureGate'
import { editableFromEvent } from './editable'
import { BLANKS_CSS, hasBlanks, renderBlanks } from './blanks'
import { createOverlayHost, isRealUserEvent } from './overlayTheme'
import {
  LIBRARY_ROWS_CSS,
  renderNote,
  renderRow,
  renderSkeleton,
} from './libraryRows'
import { sendToWorker as send } from './message'

// Type `//` in the chat box to reach anything you've saved.
//
// WHY `//` AND NOT `/`. A single slash is a live command trigger in several of
// these composers and shows up in ordinary prose ("and/or"). Two slashes mean
// nothing in any of the five sites, and they're trivially escapable — put a
// space between them. The one real collision is a URL, so the trigger requires
// a word boundary before it and `https://` never opens anything.
//
// WHY IT'S TIGHTER THAN RESURFACE. The tooltip is Deja volunteering, so it
// waits 400ms and stays out of the way. This is the person asking, on purpose,
// with two deliberate keystrokes — so it answers in 120ms and takes over the
// arrow keys until it's dismissed. Different contract, different manners.

const DEBUG = false
const DEBOUNCE_MS = 120
const SKELETON_AFTER_MS = 120
const LIMIT = 6
// A query this long isn't a query any more — the user typed `//` and kept
// writing a sentence. Let go rather than sit there filtering nothing.
const MAX_QUERY = 60

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja:picker]', ...args)
}

const MARK_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
<rect width="32" height="32" rx="8" fill="var(--dj-accent)"/>
<rect x="7" y="7" width="13" height="13" rx="3.5" fill="#fff" opacity=".4"/>
<rect x="12" y="12" width="13" height="13" rx="3.5" fill="#fff" opacity=".95"/>
<rect x="15" y="17" width="2.4" height="3.6" rx=".6" fill="var(--dj-accent)"/></svg>`

// Shares the panel's card / row language, but the chrome stays lighter: this is
// a keyboard gesture mid-typing, not a deliberate "open Deja" moment. Brand
// mark alone + query title + key chips — no wordmark stack, no foot chrome.
const PICKER_CSS = `
.dj-picker{position:fixed;width:372px;max-width:calc(100vw - 16px);
  display:flex;flex-direction:column;overflow:hidden;padding:0;border-radius:16px}
.dj-picker[hidden]{display:none}

.dj-picker-head{display:flex;align-items:center;gap:10px;padding:11px 14px;
  border-bottom:1px solid var(--dj-line);background:var(--dj-bg)}
.dj-picker-mark{width:18px;height:18px;border-radius:5px;flex:none;display:block}
.dj-picker-mark svg{width:18px;height:18px;display:block;border-radius:5px}
.dj-picker-title{flex:1;min-width:0;font-size:13.5px;font-weight:600;letter-spacing:-0.015em;
  color:var(--dj-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25}
.dj-picker-title .q{color:var(--dj-accent-text)}
.dj-keys{display:flex;gap:5px;flex:none}
.dj-keys[hidden]{display:none}
.dj-key{font-family:var(--dj-mono);font-size:10px;font-weight:500;border:1px solid var(--dj-line);
  border-radius:5px;padding:2px 6px;color:var(--dj-text-soft);background:var(--dj-surface)}

.dj-list{max-height:268px;background:var(--dj-bg);padding:10px 10px 8px;gap:8px}
` + LIBRARY_ROWS_CSS + BLANKS_CSS

/** Where the `//` token sits in the text before the caret, and what follows it. */
export interface TriggerMatch {
  /** Index of the first slash, relative to the start of the field's text. */
  at: number
  /** The query typed after the slashes. */
  query: string
}

/**
 * Find an active `//` trigger in the text before the caret.
 *
 * Returns null when there isn't one, when it's part of a URL, or when what
 * follows has stopped looking like a search. Pure and exported so the rules can
 * be tested without a DOM.
 */
export function findTrigger(before: string): TriggerMatch | null {
  const at = before.lastIndexOf('//')
  if (at === -1) return null

  // `https://`, `file://`, a bare `foo.com//bar` — anything where the slashes
  // are glued to a word is not someone reaching for their library.
  const prev = at > 0 ? before[at - 1] : ''
  if (prev && !/\s/.test(prev)) return null

  const query = before.slice(at + 2)
  if (query.length > MAX_QUERY) return null
  // A newline means they moved on; a double space means they're writing prose.
  if (/[\r\n]/.test(query)) return null
  if (/ {2,}/.test(query)) return null
  return { at, query }
}

/** The field's text up to the caret, for both textareas and contenteditables. */
function textBeforeCaret(el: HTMLElement): string | null {
  try {
    if (el instanceof HTMLTextAreaElement) {
      return el.value.slice(0, el.selectionStart ?? el.value.length)
    }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null
    const range = sel.getRangeAt(0)
    if (!el.contains(range.startContainer)) return null
    const pre = range.cloneRange()
    pre.selectNodeContents(el)
    pre.setEnd(range.startContainer, range.startOffset)
    // Range.toString() concatenates text nodes and drops block boundaries, so
    // a `//` starting a fresh paragraph would look glued to the last word of
    // the previous one and fail the word-boundary check. Render the fragment
    // and read innerText, which puts the line breaks back.
    const holder = document.createElement('div')
    holder.appendChild(pre.cloneContents())
    const rendered = holder.innerText
    return rendered || pre.toString()
  } catch {
    return null
  }
}

/**
 * Replace the `//query` token immediately behind the caret with `text`.
 *
 * Unlike the resurface tooltip — which replaces the whole box, because it fires
 * on a draft the person is rewriting anyway — the picker is an inline gesture
 * that can happen mid-sentence. "Ask them about //email" should keep "Ask them
 * about ".
 *
 * execCommand is deprecated but is what makes this land as real, undoable input
 * in the site's own editor. Returns false if nothing could be written.
 */
function replaceTrigger(el: HTMLElement, tokenLength: number, text: string): boolean {
  try {
    el.focus()
    if (el instanceof HTMLTextAreaElement) {
      const caret = el.selectionStart ?? el.value.length
      el.setSelectionRange(Math.max(0, caret - tokenLength), caret)
      if (document.execCommand('insertText', false, text)) return true
      const before = el.value.slice(0, Math.max(0, caret - tokenLength))
      const after = el.value.slice(caret)
      el.value = before + text + after
      const pos = before.length + text.length
      el.setSelectionRange(pos, pos)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    // Rich editors: walk the selection back over the token, then type over it.
    const sel = window.getSelection() as (Selection & { modify?: (...a: string[]) => void }) | null
    if (sel?.modify) {
      for (let i = 0; i < tokenLength; i++) sel.modify('extend', 'backward', 'character')
    }
    if (document.execCommand('insertText', false, text)) return true
    return false
  } catch {
    return false
  }
}

export interface PickerOptions {
  /** Called after a prompt lands in the composer, with the row's id. */
  onUsed?: (id: number) => void
}

export interface PickerHandle {
  /** True while the list is on screen — the tooltip uses this to stand down. */
  isOpen: () => boolean
  destroy: () => void
}

/**
 * Arm the `//` picker for one page. Returns a teardown.
 */
export function attachPicker(
  getInput: () => HTMLElement | null,
  platform: Platform,
  options: PickerOptions = {},
): PickerHandle {
  let prefs: Prefs = { ...DEFAULT_PREFS }
  let open = false
  let rows: LibraryRow[] = []
  let active = 0
  let activeEl: HTMLElement | null = null
  let tokenLength = 0
  let query = ''
  let debounceTimer: number | undefined
  let skeletonTimer: number | undefined
  let requestToken = 0
  /** Back out of the blanks step without closing the picker. */
  let leaveFill: (() => void) | null = null

  const layer = createOverlayHost('picker', PICKER_CSS)

  const card = document.createElement('div')
  card.className = 'dj-card dj-picker'
  card.hidden = true
  card.setAttribute('role', 'dialog')
  card.setAttribute('aria-label', 'Insert a saved prompt')

  const head = document.createElement('div')
  head.className = 'dj-picker-head'
  const markEl = document.createElement('span')
  markEl.className = 'dj-picker-mark'
  markEl.innerHTML = MARK_SVG
  markEl.setAttribute('aria-hidden', 'true')
  const title = document.createElement('span')
  title.className = 'dj-picker-title'
  const keys = document.createElement('span')
  keys.className = 'dj-keys'
  for (const k of ['↑↓', 'Enter', 'Esc']) {
    const kbd = document.createElement('span')
    kbd.className = 'dj-key'
    kbd.textContent = k
    keys.appendChild(kbd)
  }
  head.append(markEl, title, keys)

  const list = document.createElement('ul')
  list.className = 'dj-list'
  list.setAttribute('role', 'listbox')
  list.setAttribute('aria-label', 'Saved prompts')

  const fillView = document.createElement('div')
  fillView.hidden = true

  card.append(head, list, fillView)
  layer.shadow.appendChild(card)

  // ── gating ────────────────────────────────────────────────────────────────

  // Same rule the dot follows: paused or site-off still lets someone reach
  // their own library (that's reading, not recording); incognito auto-pause and
  // a "never save from…" domain mean Deja doesn't operate here at all.
  const allowedHere = (): boolean => {
    if (!prefs.slashPicker) return false
    if (!surfacesAllowed()) return false
    // Fail closed until the rules load — see presence.ts for why this differs
    // from capture's fail-open stance.
    if (!isBlocklistLoaded()) return false
    if (isBlocked(location.href, '', getBlocklist())) return false
    return true
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  const setTitle = () => {
    title.replaceChildren()
    if (query) {
      title.append(document.createTextNode('Matching “'))
      const q = document.createElement('span')
      q.className = 'q'
      q.textContent = query
      title.append(q, document.createTextNode('”'))
    } else {
      title.textContent = 'Your saved prompts'
    }
  }

  const renderRows = () => {
    if (!rows.length) {
      renderNote(
        list,
        query
          ? 'No matches this time — try a different word?'
          : 'Nothing saved yet — that’s normal. Ask something on this site and it’ll land here.',
      )
      return
    }
    list.replaceChildren()
    rows.forEach((row, i) => {
      const li = renderRow(row, () => take(i))
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', String(i === active))
      ;(li.firstElementChild as HTMLElement).dataset.active = String(i === active)
      list.appendChild(li)
    })
  }

  const markActive = () => {
    const items = list.querySelectorAll('.dj-row')
    items.forEach((el, i) => {
      const on = i === active
      ;(el as HTMLElement).dataset.active = String(on)
      el.parentElement?.setAttribute('aria-selected', String(on))
      if (on) el.scrollIntoView({ block: 'nearest' })
    })
  }

  const position = () => {
    // Host-page SPA navigations detach injected nodes on these sites; put the
    // layer back before measuring. Idempotent when it's still attached.
    layer.reattach()
    const rect = rectOf(activeEl ?? getInput())
    if (!rect) {
      close()
      return
    }
    anchorTo(card, rect, 'above', 9)
  }

  // ── open / close ──────────────────────────────────────────────────────────

  const show = () => {
    if (!open) {
      open = true
      card.hidden = false
      fillView.hidden = true
      list.hidden = false
      keys.hidden = false
      leaveFill = null
    }
    setTitle()
    position()
  }

  function close(): void {
    if (!open) return
    open = false
    card.hidden = true
    fillView.hidden = true
    list.hidden = false
    keys.hidden = false
    leaveFill = null
    rows = []
    active = 0
    query = ''
    tokenLength = 0
    window.clearTimeout(debounceTimer)
    window.clearTimeout(skeletonTimer)
    requestToken++
  }

  // ── searching ─────────────────────────────────────────────────────────────

  const runSearch = () => {
    const token = ++requestToken
    const q = query
    window.clearTimeout(skeletonTimer)
    skeletonTimer = window.setTimeout(() => {
      if (token === requestToken) renderSkeleton(list)
    }, SKELETON_AFTER_MS)

    send<LibrarySearchResponse>({ type: 'LIBRARY_SEARCH', query: q, limit: LIMIT })
      .then((resp) => {
        if (token !== requestToken || !open) return
        window.clearTimeout(skeletonTimer)
        if (!resp?.ok) {
          renderNote(list, 'Couldn’t reach your library just now.')
          return
        }
        rows = resp.rows
        active = 0
        renderRows()
        position()
      })
      .catch(() => {
        // Check the token here too — a late failure must not overwrite the
        // results of a newer keystroke that already landed.
        if (token !== requestToken || !open) return
        window.clearTimeout(skeletonTimer)
        renderNote(list, 'Couldn’t reach your library just now.')
      })
  }

  // ── taking a row ──────────────────────────────────────────────────────────

  // Always inserts, regardless of prefs.resurfaceClick — that setting governs
  // what clicking a *suggestion* does, and the picker isn't one. Someone who
  // typed `//`, searched, and chose a row has already said where they want the
  // text. Copying instead would delete their `//query` and leave the box empty
  // with the prompt on a clipboard they didn't ask for.
  const insert = (text: string, id: number) => {
    const el = activeEl ?? getInput()
    // Re-measure rather than trusting the length captured when the list was
    // built: the caret can move between opening the picker and choosing a row,
    // and a stale length would eat the wrong characters.
    let length = tokenLength
    if (el) {
      const before = textBeforeCaret(el)
      const live = before == null ? null : findTrigger(before)
      length = live ? before!.length - live.at : 0
    }
    close()
    if (el && replaceTrigger(el, length, text)) {
      void send({ type: 'PROMPT_USED', id })
      options.onUsed?.(id)
      el.focus()
      return
    }
    // Couldn't write to the field — put it on the clipboard rather than losing it.
    try {
      void navigator.clipboard?.writeText(text)?.catch(() => {})
    } catch {
      /* clipboard unavailable — nothing useful to say, and nothing broke */
    }
    void send({ type: 'PROMPT_USED', id })
    options.onUsed?.(id)
  }

  const take = (i: number) => {
    const row = rows[i]
    if (!row) return
    if (hasBlanks(row.text)) {
      list.hidden = true
      fillView.hidden = false
      keys.hidden = true
      title.textContent = 'Fill in the blanks'
      leaveFill = () => {
        fillView.hidden = true
        list.hidden = false
        keys.hidden = false
        leaveFill = null
        setTitle()
        position()
        ;(activeEl ?? getInput())?.focus()
      }
      const handle = renderBlanks(fillView, {
        text: row.text,
        onDone: (filled) => insert(filled, row.id),
        onCancel: () => leaveFill?.(),
      })
      position()
      handle.focus()
      return
    }
    insert(row.text, row.id)
  }

  // ── input wiring ──────────────────────────────────────────────────────────

  const onInput = (e: Event) => {
    if (!allowedHere()) {
      close()
      return
    }
    // Only a real person may open a surface that reads the library. Site
    // frameworks do emit synthetic input events, which is exactly why capture
    // isn't gated this way — but here, failing closed just means the picker
    // doesn't open and the dot is still there.
    if (!isRealUserEvent(e)) return

    const el = editableFromEvent(e) ?? getInput()
    if (!el || !isCapturableField(el)) {
      close()
      return
    }
    const before = textBeforeCaret(el)
    if (before == null) {
      close()
      return
    }
    const trigger = findTrigger(before)
    if (!trigger) {
      close()
      return
    }

    activeEl = el
    tokenLength = before.length - trigger.at
    const next = trigger.query.trim()
    const first = !open
    if (!first && next === query) {
      position()
      return
    }
    query = next
    show()
    if (first) renderSkeleton(list)
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(runSearch, DEBOUNCE_MS)
  }

  // Arrow keys and Enter belong to the host page unless the picker is open, so
  // every preventDefault below is guarded on `open`.
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return
    // Opening is gated on a real user; taking a row must be too, or a page
    // script could drive the selection and read what we type back.
    if (!isRealUserEvent(e)) return
    if (!fillView.hidden) {
      // Same as the Back button: leave the blanks step, keep the list open.
      // A second Escape (now on the list) closes the picker.
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        leaveFill?.()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (!rows.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      active = (active + 1) % rows.length
      markActive()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      active = (active - 1 + rows.length) % rows.length
      markActive()
      return
    }
    // Enter and Tab both take the highlighted row — Enter because it's the
    // obvious key, Tab because that's the muscle memory people bring from
    // every other inline completion they use.
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      take(active)
    }
  }

  const onPointerDown = (e: Event) => {
    if (!open) return
    // composedPath() stops at the host for a closed root, so testing for
    // `card` here is always false — which made every click on a row close the
    // picker before the click could land.
    if ((e.composedPath?.() ?? []).includes(layer.host)) return
    close()
  }

  document.addEventListener('input', onInput, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  const unwatch = watchAnchor(() => rectOf(activeEl ?? getInput()), () => {
    if (open) position()
  })

  const unsubPrefs = onPrefsChange((p) => {
    prefs = p
    if (!allowedHere()) close()
  })
  void readPrefs()
    .then((p) => {
      prefs = p
    })
    .catch(() => {
      /* keep defaults — fail open, same as the capture gate */
    })

  log('armed for', platform)

  return {
    isOpen: () => open,
    destroy() {
      close()
      unsubPrefs()
      unwatch()
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      layer.destroy()
    },
  }
}

