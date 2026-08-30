// "You've Been Here Before" — the resurface moment. As the user types, we
// debounce, ask the background worker for the closest prior prompts, and float
// a gentle tooltip above the input. Clicking a match replaces the composer
// with the remembered prompt by default (clear, then type); if the user opts
// into copy in settings, the click copies instead and confirms it did. Either
// way it's an explicit click — we never silently auto-fill. When more than one
// prompt matches, the user can step
// through them, and when more match than we surface, a "see all" jumps to the
// library. Dismissible per query (× / Esc) — a later, different prompt can
// resurface again.
//
// This file never captures (saves) anything. The only time it writes to the
// host page is the replace path, on an explicit click.
//
// Rendered inside a closed Shadow DOM so host-page CSS can't break the tooltip,
// our CSS can't leak into the host page, and page scripts can't read what's on
// screen. Palette, primitives and positioning come from overlayTheme.ts and
// anchor.ts, shared with every other in-page surface. Type is the system UI
// stack rather than Deja's bundled face: this overlay should read as part of
// the page it sits on, not as a foreign widget.

import type { Platform, SimilarMatch, SimilarResponse } from '@/lib/types'
import { isCapturableField } from '@/lib/sensitive'
import { readPrefs, onPrefsChange } from '@/lib/prefs'
import { shouldCapture } from './captureGate'
import { readText, editableFromEvent, replaceComposerText } from './editable'
import { createOverlayHost } from './overlayTheme'
import { anchorTo, rectOf, watchAnchor } from './anchor'

// Quiet by default — the host page's console must stay clean (Principle 5:
// fail silent to them). Flip to true only when debugging locally.
const DEBUG = false
const DEBOUNCE_MS = 400
const MIN_CHARS = 15
const COPIED_CONFIRM_MS = 1100

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja:resurface]', ...args)
}

// A small set of calm openers — picked at random each time the tooltip appears
// (not while stepping through candidates). Keep them short so they wrap cleanly
// on a narrow composer.
const LEAD_PHRASES = [
  "You've asked something like this before →",
  'Your earlier version is right here →',
  "You've been here before →",
]

function randomLead(): string {
  return LEAD_PHRASES[Math.floor(Math.random() * LEAD_PHRASES.length)]
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

// The tooltip's own rules. The palette and the shared primitives (card, focus
// ring, reduced-motion escape) come from overlayTheme.ts — see that file for
// why the tokens live on :host rather than being hardcoded per rule here.
const TOOLTIP_CSS = `
.dj-rs{display:flex;align-items:flex-start;gap:12px;
  max-width:min(440px,calc(100vw - 16px));padding:11px 13px}
.dj-rs[hidden]{display:none}
.dj-rs-main{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;
  background:none;border:none;padding:4px 6px;margin:-4px -6px;cursor:pointer;text-align:left;
  color:inherit;font:inherit;border-radius:var(--dj-radius-row);
  transition:background-color .15s ease}
.dj-rs-main:hover{background:var(--dj-bg)}
.dj-rs-main:focus-visible{outline:2px solid var(--dj-accent);outline-offset:1px}
.dj-rs-lead{display:flex;align-items:flex-start;gap:7px;color:var(--dj-accent-text);
  font-weight:600;font-size:13px;line-height:1.35;letter-spacing:-0.01em}
.dj-rs-dot{width:7px;height:7px;border-radius:50%;background:var(--dj-accent);flex:none;
  margin-top:5px}
.dj-rs-preview{color:var(--dj-text-soft);font-size:12.5px;line-height:1.4;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:min(400px,calc(100vw - 80px))}
.dj-rs-ctl{display:flex;align-items:center;gap:4px;flex:none;align-self:flex-start;padding-top:1px}
.dj-rs-count{color:var(--dj-text-faint);font-weight:600;font-size:11px;line-height:1;
  white-space:nowrap;font-variant-numeric:tabular-nums}
.dj-rs-all{color:var(--dj-accent-text);font-weight:600;font-size:11.5px;line-height:1;
  white-space:nowrap;flex:none;padding:5px 8px;border-radius:8px}
.dj-rs-all:hover{background:var(--dj-accent-soft)}
`

function createTooltip(onDismiss: () => void): Tooltip {
  let layer: ReturnType<typeof createOverlayHost> | null = null
  let card: HTMLElement | null = null
  let leadEl: HTMLSpanElement | null = null
  let previewEl: HTMLSpanElement | null = null
  let ctlEl: HTMLElement | null = null
  let countEl: HTMLSpanElement | null = null
  let nextEl: HTMLButtonElement | null = null
  let seeAllEl: HTMLButtonElement | null = null
  let actionHandler: (() => void) | null = null
  let nextHandler: (() => void) | null = null
  let seeAllHandler: (() => void) | null = null
  let visible = false

  const ensure = () => {
    if (layer) {
      layer.reattach()
      return
    }
    layer = createOverlayHost('resurface', TOOLTIP_CSS)
    // Announce the suggestion to screen readers when it appears.
    layer.host.setAttribute('role', 'status')
    layer.host.setAttribute('aria-live', 'polite')
    const shadow = layer.shadow

    // Shell is a group, not a button — secondary controls are real <button>s
    // so keyboard / SR users can reach See all, next, and dismiss independently.
    card = document.createElement('div')
    card.className = 'dj-card dj-rs'
    card.setAttribute('role', 'group')
    card.setAttribute('aria-label', 'Reuse a similar prompt you saved before')
    card.hidden = true

    const main = document.createElement('button')
    main.type = 'button'
    main.className = 'dj-rs-main'
    main.setAttribute('aria-label', 'Use this remembered prompt')
    // Keep the composer focused on press so replace can target the field.
    main.addEventListener('mousedown', (e) => e.preventDefault())
    main.addEventListener('click', () => actionHandler?.())

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

    main.append(lead, previewEl)

    ctlEl = document.createElement('div')
    ctlEl.className = 'dj-rs-ctl'

    seeAllEl = document.createElement('button')
    seeAllEl.type = 'button'
    seeAllEl.className = 'dj-rs-all'
    seeAllEl.textContent = 'See all in your library →'
    seeAllEl.addEventListener('mousedown', (e) => e.preventDefault())
    seeAllEl.addEventListener('click', (e) => {
      e.stopPropagation()
      seeAllHandler?.()
    })

    countEl = document.createElement('span')
    countEl.className = 'dj-rs-count'

    nextEl = document.createElement('button')
    nextEl.type = 'button'
    nextEl.className = 'dj-btn dj-x'
    nextEl.setAttribute('aria-label', 'Show the next match')
    nextEl.textContent = '›'
    nextEl.addEventListener('mousedown', (e) => e.preventDefault())
    nextEl.addEventListener('click', (e) => {
      e.stopPropagation()
      nextHandler?.()
    })

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'dj-btn dj-x'
    close.setAttribute('aria-label', 'Dismiss')
    close.textContent = '×'
    close.addEventListener('mousedown', (e) => e.preventDefault())
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      // Dismissal is owned by the caller (per-session, no nag).
      onDismiss()
    })

    ctlEl.append(seeAllEl, countEl, nextEl, close)
    card.append(main, ctlEl)
    shadow.appendChild(card)
  }

  const lockWidth = (multi: boolean) => {
    if (!card) return
    // Multi-match: lock shell width so › stays put while previews change length.
    // Single: content-size — no next control to miss.
    card.style.width = multi ? 'min(440px, calc(100vw - 16px))' : ''
  }

  const render = (view: CandidateView) => {
    if (previewEl) previewEl.textContent = view.preview
    const multi = view.total > 1
    lockWidth(multi)
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
      // confirmation state (which hides the preview/controls).
      if (previewEl) previewEl.style.display = ''
      if (ctlEl) ctlEl.style.display = ''
      // Pick a fresh opener each time the tooltip appears (kept stable while
      // the user steps through candidates via update()).
      if (leadEl) leadEl.textContent = randomLead()
      render(view)
      if (card) card.hidden = false
      visible = true
    },
    update(view) {
      if (!visible) return
      render(view)
    },
    confirm(message) {
      if (!visible) return
      // Collapse to a single confirmation line ("Copied — paste it anywhere ✓");
      // the caller hides the tooltip shortly after.
      if (leadEl) leadEl.textContent = message
      if (previewEl) previewEl.style.display = 'none'
      if (ctlEl) ctlEl.style.display = 'none'
      if (card) card.style.width = ''
    },
    hide() {
      if (card) {
        card.hidden = true
        card.style.width = ''
      }
      visible = false
    },
    reposition(anchor) {
      if (!card || !visible) return
      // Just above the input, left-aligned, clamped to the viewport (anchor.ts
      // flips it below when there's no room above).
      anchorTo(card, anchor, 'above')
    },
    isVisible: () => visible,
    destroy() {
      layer?.destroy()
      layer = null
      card = null
      leadEl = null
      previewEl = null
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

export interface ResurfaceOptions {
  /**
   * Stand down while another surface owns the space above the composer.
   *
   * The tooltip and the `//` picker anchor to the same place, so without this
   * they overlap. The picker wins, and the rule generalises: the tooltip is
   * Deja volunteering, and anything the person opened on purpose outranks it.
   * The match count is still reported — the dot keeps telling the truth about
   * the library even while the tooltip is quiet.
   */
  isSuppressed?: () => boolean
  /**
   * Called with the number of prompts that matched, every time a query
   * resolves. This is how the ambient dot gets its badge without running a
   * second query of its own — one debounced SIMILAR_QUERY already carries the
   * total, and duplicating it would double the cost of every keystroke.
   *
   * Note it fires even when the tooltip stays hidden: dismissing the tooltip
   * means "stop showing me this popup", not "I have nothing saved about this",
   * so a dot that went dark on dismissal would read as broken.
   */
  onMatchCount?: (total: number) => void
}

export function attachResurface(
  getInput: () => HTMLElement | null,
  platform: Platform,
  options: ResurfaceOptions = {},
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
  let confirmTimer: number | undefined
  let confirming = false // showing the "copied" confirmation; suppress re-query
  let queryToken = 0
  // Click behavior, from prefs: replace composer (default) or copy to clipboard.
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

  const anchorRect = (): DOMRect | null => rectOf(activeEl ?? getInput())

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

  // The × does two things on two different timescales, and they don't replace
  // each other. It suppresses this tooltip for this exact query text (session
  // only, so a different prompt can still resurface), AND it tells the worker
  // this particular saved prompt was waved away, which nudges it down the order
  // of future suggestions. This is the only place a dismissal signal comes
  // from: the panel and picker are lists someone opened on purpose, and not
  // clicking a row there isn't a rejection worth recording.
  const dismiss = () => {
    const el = activeEl ?? getInput()
    const q = lastQueried || (el ? readText(el) : '')
    const n = norm(q)
    if (n) dismissedFor = n
    const match = currentMatches[currentIndex]
    if (match && chrome.runtime?.id) {
      try {
        void chrome.runtime
          .sendMessage({ type: 'SUGGESTION_DISMISSED', id: match.id })
          .catch(() => {})
      } catch {
        /* orphaned content script — never throw into the host page */
      }
    }
    hide()
  }

  // Primary click on a match: replace the composer if insert mode is on (and the
  // composer is still around), otherwise copy to the clipboard and confirm it.
  const onAction = () => {
    const match = currentMatches[currentIndex]
    if (!match) return
    const el = activeEl ?? getInput()
    if (insertMode && el && replaceComposerText(el, match.text)) {
      log('replaced composer with prior prompt')
      confirming = true
      tooltip.confirm('Typed in for you — undo in the chat box ✓')
      window.clearTimeout(confirmTimer)
      confirmTimer = window.setTimeout(hide, COPIED_CONFIRM_MS)
      return
    }
    // Copy (or insert fell back). Confirm in-place so the user knows it
    // landed on the clipboard, then tuck the tooltip away.
    try {
      void navigator.clipboard?.writeText(match.text)?.catch(() => {})
    } catch {
      /* clipboard unavailable — fail silently, never disturb the host page */
    }
    log('copied prior prompt to clipboard')
    confirming = true
    tooltip.confirm('Copied — paste it anywhere ✓')
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
    if (options.isSuppressed?.()) {
      hide()
      return
    }
    // Stay quiet when capture is paused or this site is switched off — resurface
    // reads the in-progress text, so a paused/private session shouldn't trigger
    // it either.
    if (!shouldCapture()) {
      options.onMatchCount?.(0)
      hide()
      return
    }
    const trimmed = text.trim()
    if (trimmed.length < MIN_CHARS) {
      options.onMatchCount?.(0)
      hide()
      return
    }
    if (isDismissed(trimmed)) {
      // The tooltip stays down, but the count still stands: the user said "not
      // this popup", not "I have nothing saved like this".
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
          if (token !== queryToken) return // a later keystroke won
          if (!resp?.ok) {
            options.onMatchCount?.(0)
            hide()
            return
          }
          // Report the count before any of the tooltip's own suppression rules
          // apply — the dot reflects the library, the tooltip reflects consent.
          options.onMatchCount?.(resp.total)
          if (isDismissed(trimmed) || options.isSuppressed?.()) return
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
    // Ignore input events coming from Deja overlay inputs (search, picker, blanks)
    if ((e.composedPath?.() ?? []).some((n) => (n as HTMLElement)?.classList?.contains('dj-host'))) return

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
    // The panel and the picker claim Escape when they're open. Honouring that
    // keeps one keypress from closing two surfaces — and from recording a
    // "waved away" signal against a suggestion the person wasn't dismissing.
    if (e.defaultPrevented) return
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
  // Keep the tooltip pinned to the composer as the page moves under it.
  const unwatchAnchor = watchAnchor(anchorRect, () => {
    if (tooltip.isVisible()) reposition()
  })

  log('armed for', platform)

  return () => {
    window.clearTimeout(debounceTimer)
    window.clearTimeout(confirmTimer)
    unsubPrefs()
    unwatchAnchor()
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('focusout', onFocusOut, true)
    tooltip.destroy()
  }
}
