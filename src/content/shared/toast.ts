// A minimal, self-contained "remembered · undo" toast injected into
// the host page. Rendered inside a Shadow DOM so host CSS can't touch it and
// our CSS can't leak out. The container is pointer-events:none so it never
// intercepts clicks on the host page — only the undo button is interactive.

let host: HTMLDivElement | null = null
let hideTimer: number | undefined

function ensureHost(): ShadowRoot {
  if (host) {
    // Re-attach if a host-page SPA navigation detached our node.
    if (!host.isConnected) document.documentElement.appendChild(host)
    return host.shadowRoot as ShadowRoot
  }
  host = document.createElement('div')
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  const reduce = '@media (prefers-reduced-motion: reduce){.dj-toast{animation:none}}'
  style.textContent = `
    .dj-wrap{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
    .dj-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;
      background:#201f27;color:#f3f1ea;font:13px/1.4 'Inter',system-ui,sans-serif;
      padding:10px 12px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);
      border:1px solid #2e2c36;animation:dj-in .14s ease-out}
    .dj-dot{width:7px;height:7px;border-radius:50%;background:#8983f5;flex:none}
    .dj-msg{white-space:nowrap}
    .dj-undo{pointer-events:auto;background:none;border:none;color:#9c97f7;
      font:600 13px 'JetBrains Mono',ui-monospace,monospace;cursor:pointer;padding:2px 4px;border-radius:6px}
    .dj-undo:hover{background:#272534}
    .dj-undo:focus-visible{outline:2px solid #8983f5;outline-offset:1px}
    @keyframes dj-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    ${reduce}
  `
  shadow.appendChild(style)
  const wrap = document.createElement('div')
  wrap.className = 'dj-wrap'
  shadow.appendChild(wrap)
  document.documentElement.appendChild(host)
  return shadow
}

export function showSavedToast(onUndo: () => void): void {
  const shadow = ensureHost()
  const wrap = shadow.querySelector('.dj-wrap') as HTMLElement
  wrap.replaceChildren()

  const toast = document.createElement('div')
  toast.className = 'dj-toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')

  const dot = document.createElement('span')
  dot.className = 'dj-dot'

  const msg = document.createElement('span')
  msg.className = 'dj-msg'
  msg.textContent = 'remembered'

  const undo = document.createElement('button')
  undo.className = 'dj-undo'
  undo.textContent = 'undo'
  undo.addEventListener('click', () => {
    onUndo()
    msg.textContent = 'removed'
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
// prompt was filtered out (selective capture), so the behavior is never silent.
// Auto-dismisses; no undo, because nothing was lost (the prompt is stored as
// minor and recoverable in the library).
export function showInfoToast(message: string): void {
  const shadow = ensureHost()
  const wrap = shadow.querySelector('.dj-wrap') as HTMLElement
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
  const wrap = host?.shadowRoot?.querySelector('.dj-wrap') as HTMLElement | null
  wrap?.replaceChildren()
}
