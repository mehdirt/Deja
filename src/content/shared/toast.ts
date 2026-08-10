import { createOverlayHost } from './overlayTheme'

// A minimal, self-contained "Saved · Undo" toast injected into the host page.
// Rendered inside a closed Shadow DOM so host CSS can't touch it, our CSS can't
// leak out, and page scripts can't read it. The container is pointer-events:none
// so it never intercepts clicks on the host page — only the undo button is
// interactive.
//
// The toast is the one overlay that stays dark in both themes. That's on
// purpose: it's a transient confirmation in the corner of somebody else's page,
// and a dark chip reads as a notification everywhere, where a warm-paper card
// reads as part of the site's own UI and gets missed.

const TOAST_CSS = `
.dj-wrap{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.dj-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;
  background:#1e1d28;color:#f3f1ea;font:var(--dj-font);
  padding:10px 12px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);
  border:1px solid #3f3c4a;animation:dj-in .14s ease-out}
.dj-dot{width:7px;height:7px;border-radius:50%;background:#8983f5;flex:none}
.dj-msg{white-space:nowrap}
.dj-undo{pointer-events:auto;background:none;border:none;color:#9c97f7;
  font:600 13px system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;padding:2px 4px;border-radius:6px}
.dj-undo:hover{background:#2a2740}
.dj-undo:focus-visible{outline:2px solid #8983f5;outline-offset:1px}
`

let layer: ReturnType<typeof createOverlayHost> | null = null
let wrapEl: HTMLElement | null = null
let hideTimer: number | undefined

function ensureWrap(): HTMLElement {
  if (layer && wrapEl) {
    // Re-attach if a host-page SPA navigation detached our node.
    layer.reattach()
    return wrapEl
  }
  layer = createOverlayHost('toast', TOAST_CSS)
  wrapEl = document.createElement('div')
  wrapEl.className = 'dj-wrap'
  layer.shadow.appendChild(wrapEl)
  return wrapEl
}

export function showSavedToast(onUndo: () => void, note?: string): void {
  const wrap = ensureWrap()
  wrap.replaceChildren()

  const toast = document.createElement('div')
  toast.className = 'dj-toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')

  const dot = document.createElement('span')
  dot.className = 'dj-dot'

  const msg = document.createElement('span')
  msg.className = 'dj-msg'
  // `note` (e.g. "2 details hidden") is appended so redaction is never silent.
  msg.textContent = note ? `Saved for you ✔ · ${note}` : 'Saved for you ✔'

  const undo = document.createElement('button')
  undo.className = 'dj-undo'
  undo.textContent = 'Undo'
  undo.addEventListener('click', () => {
    onUndo()
    msg.textContent = 'Okay, removed'
    undo.remove()
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(dismiss, 1200)
  })

  toast.append(dot, msg, undo)
  wrap.appendChild(toast)

  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(dismiss, 5000)
}

// A quiet, button-less toast — used once to explain that a short throwaway
// prompt was not stored (selective capture), so the skip is never silent.
// Auto-dismisses; no undo, because nothing was written.
export function showInfoToast(message: string): void {
  const wrap = ensureWrap()
  wrap.replaceChildren()

  const toast = document.createElement('div')
  toast.className = 'dj-toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')

  const dot = document.createElement('span')
  dot.className = 'dj-dot'

  const msg = document.createElement('span')
  msg.className = 'dj-msg'
  msg.textContent = message

  toast.append(dot, msg)
  wrap.appendChild(toast)

  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(dismiss, 6000)
}

function dismiss(): void {
  wrapEl?.replaceChildren()
}
