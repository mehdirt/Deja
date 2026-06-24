// "You've Been Here Before" — the resurface moment. As the user types, we
// debounce, ask the background worker for the closest prior prompt, and float
// a gentle tooltip above the input. Clicking it copies the OLD prompt to the
// clipboard (we never auto-fill — respect the user). Dismissible per page
// session, never nags. Read-only: this file captures nothing.
//
// Rendered inside a Shadow DOM so host-page CSS can't break the tooltip and
// our CSS can't leak into the host page. Mirrors the "notebook meets terminal"
// identity (warm paper / ink / indigo, JetBrains Mono for the mono bits) with
// a handful of hardcoded colors and a dark-mode media query.

import type { Platform, SimilarMatch, SimilarResponse } from '@/lib/types'
import { isCapturableField } from '@/lib/sensitive'

// Quiet by default — the host page's console must stay clean (Principle 5:
// fail silent to them). Flip to true only when debugging locally.
const DEBUG = false
const DEBOUNCE_MS = 400
const MIN_CHARS = 15
const REPOSITION_THROTTLE_MS = 100

function log(...args: unknown[]) {
  if (DEBUG) console.log('[Deja:resurface]', ...args)
}

// Read only what we're allowed to read. Like capture, resurface must never
// touch an <input> (so a password field's value is unreachable) — it only ever
// reads the textarea/contenteditable composer. Inputs are gated out upstream
// by isCapturableField, but we also refuse to read .value here as a backstop.
function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement) return el.value
  return el.innerText
}

// ── Shadow-DOM tooltip ──────────────────────────────────────────────────────

interface Tooltip {
  show: (preview: string, onClick: () => void) => void
  hide: () => void
  reposition: (anchor: DOMRect) => void
  isVisible: () => boolean
  destroy: () => void
}

function createTooltip(onDismiss: () => void): Tooltip {
  let host: HTMLDivElement | null = null
  let card: HTMLButtonElement | null = null
  let previewEl: HTMLSpanElement | null = null
  let clickHandler: (() => void) | null = null
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
      .dj-rs{position:fixed;left:0;top:0;max-width:min(420px,calc(100vw - 16px));pointer-events:auto;
        display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;
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
        font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(380px,calc(100vw - 80px))}
      .dj-rs-x{pointer-events:auto;flex:none;background:none;border:none;cursor:pointer;
        color:#9a968d;font:600 14px/1 'JetBrains Mono',ui-monospace,monospace;
        padding:2px 4px;border-radius:6px;align-self:flex-start}
      .dj-rs-x:hover{background:#e7e2d8;color:#1c1b19}
      .dj-rs-x:focus-visible{outline:2px solid #5b54f0;outline-offset:1px}
      @keyframes dj-rs-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion: reduce){.dj-rs{animation:none}}
      @media (prefers-color-scheme: dark){
        .dj-rs{background:#201f27;color:#f3f1ea;border-color:#2e2c36;box-shadow:0 8px 28px rgba(0,0,0,.4)}
        .dj-rs:hover{background:#272534}
        .dj-rs-lead{color:#9c97f7}
        .dj-rs-dot{background:#8983f5}
        .dj-rs-preview{color:#a8a49b}
        .dj-rs-x{color:#6e6a62}
        .dj-rs-x:hover{background:#2e2c36;color:#f3f1ea}
      }
    `
    shadow.appendChild(style)

    card = document.createElement('button')
    card.type = 'button'
    card.className = 'dj-rs'
    card.setAttribute('aria-label', 'Copy a similar prompt you saved before')
    card.style.display = 'none'

    const body = document.createElement('div')
    body.className = 'dj-rs-body'

    const lead = document.createElement('span')
    lead.className = 'dj-rs-lead'
    const dot = document.createElement('span')
    dot.className = 'dj-rs-dot'
    const leadText = document.createElement('span')
    leadText.textContent = "You've asked something like this before →"
    lead.append(dot, leadText)

    previewEl = document.createElement('span')
    previewEl.className = 'dj-rs-preview'

    body.append(lead, previewEl)

    const close = document.createElement('span')
    close.className = 'dj-rs-x'
    close.setAttribute('aria-label', 'Dismiss')
    close.textContent = '×'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      // Dismissal is owned by the caller (per-session, no nag).
      onDismiss()
    })

    card.addEventListener('click', () => clickHandler?.())

    card.append(body, close)
    shadow.appendChild(card)
    document.documentElement.appendChild(host)
  }

  return {
    show(preview, onClick) {
      ensure()
      clickHandler = onClick
      if (previewEl) previewEl.textContent = preview
      if (card) card.style.display = 'flex'
      visible = true
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
      previewEl = null
      clickHandler = null
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
  let dismissed = false // dismissed for this page session — never nag again
  let currentMatch: SimilarMatch | null = null
  let lastQueried = ''
  let repositionTimer: number | undefined
  let queryToken = 0

  const anchorRect = (): DOMRect | null => {
    const el = getInput()
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
    currentMatch = null
    lastQueried = ''
    // Invalidate any in-flight query so a late response (debounce + worker
    // wake latency) can't re-show the tooltip after submit/blur/dismiss.
    queryToken += 1
    tooltip.hide()
  }

  const dismiss = () => {
    dismissed = true
    hide()
  }

  const onClickCopy = () => {
    if (!currentMatch) return
    const text = currentMatch.text
    try {
      void navigator.clipboard?.writeText(text)?.catch(() => {})
    } catch {
      /* clipboard unavailable — fail silently, never disturb the host page */
    }
    log('copied prior prompt to clipboard')
    // A copy is a successful resurface; tuck the tooltip away for now.
    hide()
  }

  const runQuery = (text: string) => {
    if (dismissed) return
    const trimmed = text.trim()
    if (trimmed.length < MIN_CHARS) {
      hide()
      return
    }
    if (trimmed === lastQueried && currentMatch) {
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
          if (token !== queryToken || dismissed) return // stale or dismissed
          if (!resp?.ok) {
            hide()
            return
          }
          const match = resp.match
          if (!match) {
            hide()
            return
          }
          // Freeze the first surfaced match: once the tooltip is up, don't
          // swap the preview under the user as they keep typing — that reads
          // as pushy/"alive". It stays put until hidden or dismissed.
          if (tooltip.isVisible() && currentMatch) {
            reposition()
            return
          }
          currentMatch = match
          const preview = match.text.replace(/\s+/g, ' ').trim()
          tooltip.show(preview, onClickCopy)
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
    if (dismissed) return
    const el = getInput()
    if (!el) return
    // Same gate as capture: never read a sensitive or non-composer field, so a
    // password/OTP/credential the user types can't be sent to the worker even
    // for an in-memory similarity check.
    if (!isCapturableField(el)) {
      hide()
      return
    }
    // Only react to typing in the prompt input itself.
    const target = e.target as Node | null
    if (target && target !== el && !el.contains(target)) {
      // composedPath fallback for retargeted contenteditable events
      const path = (e.composedPath?.() ?? []) as Node[]
      if (!path.includes(el)) return
    }
    const text = readText(el)
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => runQuery(text), DEBOUNCE_MS)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && tooltip.isVisible()) {
      // Esc dismisses for the session, but don't swallow it from the host page.
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
    window.setTimeout(() => {
      const el = getInput()
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
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('focusout', onFocusOut, true)
    window.removeEventListener('scroll', onScrollResize, true)
    window.removeEventListener('resize', onScrollResize, true)
    tooltip.destroy()
  }
}
