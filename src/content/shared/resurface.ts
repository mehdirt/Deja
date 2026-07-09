// "You've Been Here Before" — the resurface moment. As the user types, we
// debounce, ask the background worker for the closest prior prompts, and float
// a gentle tooltip above the input. Clicking a match COPIES it to the clipboard
// by default (and confirms it did); if the user opts into "insert at cursor" in
// settings, the click instead inserts it at the caret in the composer. Either
// way it's an explicit click — we never silently auto-fill, and never overwrite
// what's already typed. When more than one prompt matches, the user can step
// through them, and when more match than we surface, a "see all" jumps to the
// library. Dismissible per query (× / Esc) — a later, different prompt can
// resurface again.
//
// This file never captures (saves) anything. The only time it writes to the
// host page is the opt-in insert, on an explicit click.
//
// Rendered inside a Shadow DOM so host-page CSS can't break the tooltip and
// our CSS can't leak into the host page. Mirrors the "notebook meets terminal"
// identity (warm paper / ink / indigo, JetBrains Mono for the mono bits) with
// a handful of hardcoded colors and a dark-mode media query.

import type { Platform, SimilarMatch, SimilarResponse } from '@/lib/types'
import { isCapturableField } from '@/lib/sensitive'
import { readPrefs, onPrefsChange } from '@/lib/prefs'
import { shouldCapture } from './captureGate'

// Quiet by default — the host page's console must stay clean (Principle 5:
// fail silent to them). Flip to true only when debugging locally.
const DEBUG = false
const DEBOUNCE_MS = 400
const MIN_CHARS = 15
const REPOSITION_THROTTLE_MS = 100
const COPIED_CONFIRM_MS = 1100

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja:resurface]', ...args)
}

// A small rotation of openers so the moment doesn't feel robotic — one is
// picked at random each time the tooltip appears (not while stepping through
// candidates). Keep them calm and short; the trailing arrow is part of the copy.
const LEAD_PHRASES = [
  "You've asked something like this before →",
  "You've been here before →",
  "You've written something like this →",
  'This looks familiar →',
  'Seen this one before →',
  'Déjà vu — you saved a prompt like this →',
  'An earlier prompt of yours fits →',
  "Wait — you've done this before →",
]

function randomLead(): string {
  return LEAD_PHRASES[Math.floor(Math.random() * LEAD_PHRASES.length)]
}

// Read only what we're allowed to read. Like capture, resurface must never
// touch an <input> (so a password field's value is unreachable) — it only ever
// reads the textarea/contenteditable composer. Inputs are gated out upstream
// by isCapturableField, but we also refuse to read .value here as a backstop.
function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement) return el.value
  return el.innerText
}

// Insert text at the caret in the composer the user is typing in (opt-in path).
// execCommand('insertText') is deprecated but remains the most reliable way to
// insert at the caret across both <textarea> and rich contenteditable editors
// (ProseMirror, Quill) — it's undoable and the site's framework registers it as
// real input. Falls back to a manual splice for plain textareas. Returns false
// if nothing could be inserted (caller then falls back to copy). Never throws.
function insertAtCaret(el: HTMLElement, text: string): boolean {
  try {
    el.focus()
    if (document.execCommand('insertText', false, text)) return true
    if (el instanceof HTMLTextAreaElement) {
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      el.value = el.value.slice(0, start) + text + el.value.slice(end)
      const caret = start + text.length
      el.selectionStart = el.selectionEnd = caret
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    return false
  } catch {
    return false
  }
}

// The editable the user is actually typing in, resolved from the event path —
// the same approach capture.ts uses. This is what makes resurface react
// wherever capture does: trusting the page selector alone is fragile, because a
// site's composer node can differ from what the selector resolves to (or drift
// over time), and then the old "is the typed element the selector element?"
// check would silently bail and never query. composedPath() also pierces Shadow
// DOM. Returns null if the event isn't in a capturable (textarea/contenteditable,
// non-sensitive) field, so password/OTP fields are still never read.
function editableFromEvent(e: Event): HTMLElement | null {
  const path = (e.composedPath?.() ?? []) as Element[]
  for (const node of path) {
    if (isCapturableField(node)) return node
  }
  const target = e.target as Element | null
  const closest = target?.closest?.('textarea, [contenteditable="true"]') ?? null
  return isCapturableField(closest) ? closest : null
}

// ── Shadow-DOM tooltip ──────────────────────────────────────────────────────

// What the tooltip renders for the candidate currently in focus.
interface CandidateView {
  preview: string
  terms: string[]
  index: number
  total: number
  // How many additional matches exist beyond the ones surfaced inline (drives
  // the "see all" affordance). 0 means the tooltip shows everything that matched.
  more: number
}

interface TooltipHandlers {
  onAction: () => void
  onNext: () => void
  onSeeAll: () => void
}

interface Tooltip {
  show: (view: CandidateView, handlers: TooltipHandlers) => void
  update: (view: CandidateView) => void
  confirm: (message: string) => void
  hide: () => void
  reposition: (anchor: DOMRect) => void
  isVisible: () => boolean
  destroy: () => void
}

function createTooltip(onDismiss: () => void): Tooltip {
  let host: HTMLDivElement | null = null
  let card: HTMLButtonElement | null = null
  let leadEl: HTMLSpanElement | null = null
  let previewEl: HTMLSpanElement | null = null
  let metaEl: HTMLSpanElement | null = null
  let ctlEl: HTMLSpanElement | null = null
  let countEl: HTMLSpanElement | null = null
  let nextEl: HTMLSpanElement | null = null
  let seeAllEl: HTMLSpanElement | null = null
  let actionHandler: (() => void) | null = null
  let nextHandler: (() => void) | null = null
  let seeAllHandler: (() => void) | null = null
  let visible = false

  const ensure = () => {
    if (host) {
      if (!host.isConnected) document.documentElement.appendChild(host)
      return
    }
    host = document.createElement('div')
    // pointer-events:none on the layer so the host page stays clickable; only
    // the card itself opts back in.
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
    // Announce the suggestion to screen readers when it appears.
    host.setAttribute('role', 'status')
    host.setAttribute('aria-live', 'polite')
    const shadow = host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    // Colors are hardcoded to mirror the --dj-* tokens in src/styles/globals.css
    // (shadow DOM + :host{all:initial} blocks variable inheritance). If the
    // palette there changes, update these to match.
    style.textContent = `
      :host{all:initial}
      .dj-rs{position:fixed;left:0;top:0;max-width:min(440px,calc(100vw - 16px));pointer-events:auto;
        display:flex;align-items:flex-start;gap:10px;text-align:left;cursor:pointer;
        background:#faf8f3;color:#1c1b19;border:1px solid #e7e2d8;
        border-radius:10px;padding:8px 10px;box-shadow:0 8px 28px rgba(0,0,0,.18);
        font:13px/1.4 'Inter',system-ui,-apple-system,sans-serif;
        animation:dj-rs-in .14s ease-out;transition:opacity .1s ease}
      .dj-rs:hover{background:#f1ede4}
      .dj-rs:focus-visible{outline:2px solid #5b54f0;outline-offset:1px}
      .dj-rs-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
      .dj-rs-lead{display:flex;align-items:center;gap:6px;color:#5b54f0;font-weight:600;white-space:nowrap}
      .dj-rs-dot{width:6px;height:6px;border-radius:50%;background:#5b54f0;flex:none}
      .dj-rs-preview{color:#6b6862;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
        font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(400px,calc(100vw - 80px))}
      .dj-rs-meta{color:#9a968d;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        max-width:min(400px,calc(100vw - 80px))}
      .dj-rs-meta:empty{display:none}
      .dj-rs-ctl{display:flex;align-items:center;gap:4px;flex:none;align-self:flex-start}
      .dj-rs-count{color:#9a968d;font:600 10px/1 'JetBrains Mono',ui-monospace,monospace;white-space:nowrap}
      .dj-rs-all{pointer-events:auto;flex:none;background:none;border:none;cursor:pointer;white-space:nowrap;
        color:#5b54f0;font:600 11px/1 'Inter',system-ui,sans-serif;padding:2px 5px;border-radius:6px}
      .dj-rs-all:hover{background:#ecebfe}
      .dj-rs-next,.dj-rs-x{pointer-events:auto;flex:none;background:none;border:none;cursor:pointer;
        color:#9a968d;font:600 14px/1 'JetBrains Mono',ui-monospace,monospace;
        padding:2px 4px;border-radius:6px}
      .dj-rs-next:hover,.dj-rs-x:hover{background:#e7e2d8;color:#1c1b19}
      .dj-rs-all:focus-visible,.dj-rs-next:focus-visible,.dj-rs-x:focus-visible{outline:2px solid #5b54f0;outline-offset:1px}
      @keyframes dj-rs-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion: reduce){.dj-rs{animation:none}}
      @media (prefers-color-scheme: dark){
        .dj-rs{background:#201f27;color:#f3f1ea;border-color:#2e2c36;box-shadow:0 8px 28px rgba(0,0,0,.4)}
        .dj-rs:hover{background:#272534}
        .dj-rs-lead{color:#9c97f7}
        .dj-rs-dot{background:#8983f5}
        .dj-rs-preview{color:#a8a49b}
        .dj-rs-meta,.dj-rs-count{color:#6e6a62}
        .dj-rs-all{color:#9c97f7}
        .dj-rs-all:hover{background:#272534}
        .dj-rs-next,.dj-rs-x{color:#6e6a62}
        .dj-rs-next:hover,.dj-rs-x:hover{background:#2e2c36;color:#f3f1ea}
      }
    `
    shadow.appendChild(style)

    card = document.createElement('button')
    card.type = 'button'
    card.className = 'dj-rs'
    card.setAttribute('aria-label', 'Reuse a similar prompt you saved before')
    card.style.display = 'none'
    // Keep the composer focused when the card is pressed: preventing the default
    // mousedown stops focus from moving to the button, so the opt-in insert can
    // write at the caret of the field the user was typing in.
    card.addEventListener('mousedown', (e) => e.preventDefault())

    const body = document.createElement('div')
    body.className = 'dj-rs-body'

    const lead = document.createElement('span')
    lead.className = 'dj-rs-lead'
    const dot = document.createElement('span')
    dot.className = 'dj-rs-dot'
    leadEl = document.createElement('span')
    // The opener text is chosen at random in show(), so each appearance varies.
    leadEl.textContent = LEAD_PHRASES[0]
    lead.append(dot, leadEl)

    previewEl = document.createElement('span')
    previewEl.className = 'dj-rs-preview'

    metaEl = document.createElement('span')
    metaEl.className = 'dj-rs-meta'

    body.append(lead, previewEl, metaEl)

    // Right-side controls: a "see all" link (only when more matched than we
    // surface), a "1/3" counter and a "›" step button (only when >1 surfaced),
    // then the dismiss ×. These are <span>s — not interactive content per HTML,
    // so nesting them inside the <button> card is valid — and each stops
    // propagation so it doesn't trip the card's primary action.
    ctlEl = document.createElement('span')
    ctlEl.className = 'dj-rs-ctl'

    seeAllEl = document.createElement('span')
    seeAllEl.className = 'dj-rs-all'
    seeAllEl.textContent = 'see all →'
    seeAllEl.addEventListener('click', (e) => {
      e.stopPropagation()
      seeAllHandler?.()
    })

    countEl = document.createElement('span')
    countEl.className = 'dj-rs-count'

    nextEl = document.createElement('span')
    nextEl.className = 'dj-rs-next'
    nextEl.setAttribute('aria-label', 'Show the next match')
    nextEl.textContent = '›'
    nextEl.addEventListener('click', (e) => {
      e.stopPropagation()
      nextHandler?.()
    })

    const close = document.createElement('span')
    close.className = 'dj-rs-x'
    close.setAttribute('aria-label', 'Dismiss')
    close.textContent = '×'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      // Dismissal is owned by the caller (per-session, no nag).
      onDismiss()
    })

    ctlEl.append(seeAllEl, countEl, nextEl, close)

    card.addEventListener('click', () => actionHandler?.())

    card.append(body, ctlEl)
    shadow.appendChild(card)
    document.documentElement.appendChild(host)
  }

  const render = (view: CandidateView) => {
    if (previewEl) previewEl.textContent = view.preview
    if (metaEl) metaEl.textContent = view.terms.length ? `matched on ${view.terms.join(', ')}` : ''
    const multi = view.total > 1
    if (countEl) {
      countEl.textContent = multi ? `${view.index + 1}/${view.total}` : ''
      countEl.style.display = multi ? '' : 'none'
    }
    if (nextEl) nextEl.style.display = multi ? '' : 'none'
    if (seeAllEl) seeAllEl.style.display = view.more > 0 ? '' : 'none'
  }

  return {
    show(view, handlers) {
      ensure()
      actionHandler = handlers.onAction
      nextHandler = handlers.onNext
      seeAllHandler = handlers.onSeeAll
      // Restore the normal layout in case the card was last left in a "copied"
      // confirmation state (which hides the preview/meta/controls).
      if (previewEl) previewEl.style.display = ''
      if (metaEl) metaEl.style.display = ''
      if (ctlEl) ctlEl.style.display = ''
      // Pick a fresh opener each time the tooltip appears (kept stable while
      // the user steps through candidates via update()).
      if (leadEl) leadEl.textContent = randomLead()
      render(view)
      if (card) card.style.display = 'flex'
      visible = true
    },
    update(view) {
      if (!visible) return
      render(view)
    },
    confirm(message) {
      if (!visible) return
      // Collapse to a single confirmation line ("copied to clipboard ✓"); the
      // caller hides the tooltip shortly after.
      if (leadEl) leadEl.textContent = message
      if (previewEl) previewEl.style.display = 'none'
      if (metaEl) metaEl.style.display = 'none'
      if (ctlEl) ctlEl.style.display = 'none'
    },
    hide() {
      if (card) card.style.display = 'none'
      visible = false
    },
    reposition(anchor) {
      if (!card || !visible) return
      // Anchor just above the input, left-aligned, clamped to the viewport.
      card.style.visibility = 'hidden'
      card.style.display = 'flex'
      const h = card.offsetHeight || 44
      const w = card.offsetWidth || 320
      let top = anchor.top - h - 8
      if (top < 8) top = anchor.bottom + 8 // flip below if no room above
      let left = anchor.left
      const maxLeft = window.innerWidth - w - 8
      if (left > maxLeft) left = Math.max(8, maxLeft)
      if (left < 8) left = 8
      card.style.left = `${left}px`
      card.style.top = `${top}px`
      card.style.visibility = 'visible'
    },
    isVisible: () => visible,
    destroy() {
      try {
        host?.remove()
      } catch {
        /* ignore */
      }
      host = null
      card = null
      leadEl = null
      previewEl = null
      metaEl = null
      ctlEl = null
      countEl = null
      nextEl = null
      seeAllEl = null
      actionHandler = null
      nextHandler = null
      seeAllHandler = null
      visible = false
    },
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function attachResurface(
  getInput: () => HTMLElement | null,
  platform: Platform,
): () => void {
  // dismiss() is defined below; the thunk defers the reference so the tooltip's
  // × can trigger per-session dismissal.
  const tooltip = createTooltip(() => dismiss())

  let debounceTimer: number | undefined
  // Normalized query the user dismissed (× / Esc). Suppresses only that text,
  // not the whole page session — so a later, different prompt can resurface.
  let dismissedFor: string | null = null
  let currentMatches: SimilarMatch[] = []
  let currentIndex = 0
  let grandTotal = 0 // total matches above threshold, incl. those not surfaced
  let lastQueried = ''
  let repositionTimer: number | undefined
  let confirmTimer: number | undefined
  let confirming = false // showing the "copied" confirmation; suppress re-query
  let queryToken = 0
  // Click behavior, from prefs: copy to clipboard (default) or insert at caret.
  let insertMode = false
  // The editable the user is currently typing in, as resolved from the input
  // event. We anchor and re-read from this (falling back to the page selector)
  // so resurface tracks the real composer even when it differs from getInput().
  let activeEl: HTMLElement | null = null

  void readPrefs().then((p) => {
    insertMode = p.resurfaceClick === 'insert'
  })
  const unsubPrefs = onPrefsChange((p) => {
    insertMode = p.resurfaceClick === 'insert'
  })

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

  const isDismissed = (text: string) => {
    const n = norm(text)
    return n.length > 0 && dismissedFor === n
  }

  const viewFor = (i: number): CandidateView => ({
    preview: currentMatches[i].text.replace(/\s+/g, ' ').trim(),
    terms: currentMatches[i].terms,
    index: i,
    total: currentMatches.length,
    more: Math.max(0, grandTotal - currentMatches.length),
  })

  const anchorRect = (): DOMRect | null => {
    const el = activeEl ?? getInput()
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return r
  }

  const reposition = () => {
    const r = anchorRect()
    if (!r) {
      tooltip.hide()
      return
    }
    tooltip.reposition(r)
  }

  const hide = () => {
    currentMatches = []
    currentIndex = 0
    grandTotal = 0
    lastQueried = ''
    activeEl = null
    confirming = false
    window.clearTimeout(confirmTimer)
    // Cancel any pending debounced query. Without this, a query scheduled by the
    // last keystroke before submit fires ~400 ms later — against the prompt that
    // was just sent and saved — and resurfaces it as a "match" the instant the
    // composer is empty again. (See onInput: we also re-read the live text at
    // fire time, which covers Send-button submits that never trigger this hide.)
    window.clearTimeout(debounceTimer)
    // Invalidate any in-flight query so a late response (debounce + worker
    // wake latency) can't re-show the tooltip after submit/blur/dismiss.
    queryToken += 1
    tooltip.hide()
  }

  const dismiss = () => {
    const el = activeEl ?? getInput()
    const q = lastQueried || (el ? readText(el) : '')
    const n = norm(q)
    if (n) dismissedFor = n
    hide()
  }

  // Primary click on a match: insert at the caret if the user opted in (and the
  // composer is still around), otherwise copy to the clipboard and confirm it.
  const onAction = () => {
    const match = currentMatches[currentIndex]
    if (!match) return
    const el = activeEl ?? getInput()
    if (insertMode && el && insertAtCaret(el, match.text)) {
      log('inserted prior prompt at caret')
      hide()
      return
    }
    // Copy (the default, or insert fell back). Confirm in-place so the user
    // knows it landed on the clipboard, then tuck the tooltip away.
    try {
      void navigator.clipboard?.writeText(match.text)?.catch(() => {})
    } catch {
      /* clipboard unavailable — fail silently, never disturb the host page */
    }
    log('copied prior prompt to clipboard')
    confirming = true
    tooltip.confirm('copied to clipboard ✓')
    window.clearTimeout(confirmTimer)
    confirmTimer = window.setTimeout(hide, COPIED_CONFIRM_MS)
  }

  // Step to the next candidate, wrapping around. We don't swap in fresh query
  // results while the tooltip is up (that reads as pushy), so stepping only
  // ever cycles the set that was frozen when the tooltip first appeared.
  const onNext = () => {
    if (confirming || currentMatches.length < 2) return
    currentIndex = (currentIndex + 1) % currentMatches.length
    tooltip.update(viewFor(currentIndex))
    reposition()
  }

  // Open the full library, pre-searched with what the user is typing, when more
  // matched than we surfaced inline.
  const onSeeAll = () => {
    if (!chrome.runtime?.id) return
    try {
      void chrome.runtime.sendMessage({ type: 'OPEN_LIBRARY', query: lastQueried }).catch(() => {})
    } catch {
      /* orphaned content script — never throw into the host page */
    }
    hide()
  }

  const runQuery = (text: string) => {
    if (confirming) return
    // Stay quiet when capture is paused or this site is switched off — resurface
    // reads the in-progress text, so a paused/private session shouldn't trigger
    // it either.
    if (!shouldCapture()) {
      hide()
      return
    }
    const trimmed = text.trim()
    if (trimmed.length < MIN_CHARS) {
      hide()
      return
    }
    if (isDismissed(trimmed)) {
      hide()
      return
    }
    if (trimmed === lastQueried && currentMatches.length) {
      reposition()
      return
    }
    lastQueried = trimmed

    if (!chrome.runtime?.id) return
    const token = ++queryToken
    try {
      chrome.runtime
        .sendMessage({ type: 'SIMILAR_QUERY', text: trimmed })
        .then((resp: SimilarResponse | undefined) => {
          if (token !== queryToken || isDismissed(trimmed)) return // stale or dismissed
          if (!resp?.ok) {
            hide()
            return
          }
          const matches = resp.matches
          if (!matches.length) {
            hide()
            return
          }
          // Freeze the surfaced set: once the tooltip is up, don't swap matches
          // under the user as they keep typing — that reads as pushy/"alive".
          // It stays put (the user can step through it) until hidden/dismissed.
          if (tooltip.isVisible() && currentMatches.length) {
            reposition()
            return
          }
          currentMatches = matches
          currentIndex = 0
          grandTotal = resp.total
          tooltip.show(viewFor(0), { onAction, onNext, onSeeAll })
          reposition()
        })
        .catch(() => {
          /* worker asleep or orphaned — fail silently */
        })
    } catch {
      /* orphaned content script — never throw into the host page */
    }
  }

  const onInput = (e: Event) => {
    // Resolve the editable from the event first (robust to composers that
    // differ from the page selector or have drifted), falling back to the
    // platform selector. This is the same resolution capture uses, so resurface
    // now fires wherever capture does. isCapturableField on the event path
    // already excludes <input>/password/OTP fields, so credentials are never
    // read even for an in-memory similarity check.
    const el = editableFromEvent(e) ?? getInput()
    if (!el) return
    if (!isCapturableField(el)) {
      hide()
      return
    }
    activeEl = el
    window.clearTimeout(debounceTimer)
    // Re-read the composer's text when the timer fires, not now. If a submit (or
    // any clear) happened during the debounce window — including a Send-button
    // click that never fires our Enter handler — the field is empty by fire time,
    // so runQuery sees too little text and bails instead of querying the prompt
    // that was just sent. Resolving the live element also keeps us on the right
    // composer if it changed mid-debounce.
    debounceTimer = window.setTimeout(() => {
      const live = activeEl ?? getInput()
      if (!live || !isCapturableField(live)) {
        hide()
        return
      }
      runQuery(readText(live))
    }, DEBOUNCE_MS)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && tooltip.isVisible()) {
      // Esc dismisses this match for the current query text.
      dismiss()
      return
    }
    // Submitting hides the tooltip (capture.ts handles the actual save).
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing) {
      hide()
    }
  }

  const onScrollResize = () => {
    if (!tooltip.isVisible()) return
    if (repositionTimer != null) return
    repositionTimer = window.setTimeout(() => {
      repositionTimer = undefined
      reposition()
    }, REPOSITION_THROTTLE_MS)
  }

  const onFocusOut = () => {
    // If the input is cleared or focus leaves it, the prompt is gone — hide.
    // While confirming a copy, leave the tooltip alone (clicking it blurred the
    // composer); its own timer will dismiss it.
    if (confirming) return
    window.setTimeout(() => {
      if (confirming) return
      const el = activeEl ?? getInput()
      if (!el || readText(el).trim().length < MIN_CHARS) hide()
    }, 0)
  }

  document.addEventListener('input', onInput, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('focusout', onFocusOut, true)
  window.addEventListener('scroll', onScrollResize, true)
  window.addEventListener('resize', onScrollResize, true)

  log('armed for', platform)

  return () => {
    window.clearTimeout(debounceTimer)
    window.clearTimeout(repositionTimer)
    window.clearTimeout(confirmTimer)
    unsubPrefs()
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('focusout', onFocusOut, true)
    window.removeEventListener('scroll', onScrollResize, true)
    window.removeEventListener('resize', onScrollResize, true)
    tooltip.destroy()
  }
}
