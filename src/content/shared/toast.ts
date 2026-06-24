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
  const reduce = '@media (prefers-reduced-motion: reduce){.ps-toast{animation:none}}'
  style.textContent = `
    .ps-wrap{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
    .ps-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;
      background:#201f27;color:#f3f1ea;font:13px/1.4 'Inter',system-ui,sans-serif;
      padding:10px 12px;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.28);
      border:1px solid #2e2c36;animation:ps-in .14s ease-out}
    .ps-dot{width:7px;height:7px;border-radius:50%;background:#8983f5;flex:none}
    .ps-msg{white-space:nowrap}
    .ps-undo{pointer-events:auto;background:none;border:none;color:#9c97f7;
      font:600 13px 'JetBrains Mono',ui-monospace,monospace;cursor:pointer;padding:2px 4px;border-radius:6px}
    .ps-undo:hover{background:#272534}
    .ps-undo:focus-visible{outline:2px solid #8983f5;outline-offset:1px}
    @keyframes ps-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    ${reduce}
  `
  shadow.appendChild(style)
  const wrap = document.createElement('div')
  wrap.className = 'ps-wrap'
  shadow.appendChild(wrap)
  document.documentElement.appendChild(host)
  return shadow
}

export function showSavedToast(onUndo: () => void): void {
  const shadow = ensureHost()
  const wrap = shadow.querySelector('.ps-wrap') as HTMLElement
  wrap.replaceChildren()

  const toast = document.createElement('div')
  toast.className = 'ps-toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')

  const dot = document.createElement('span')
  dot.className = 'ps-dot'

  const msg = document.createElement('span')
  msg.className = 'ps-msg'
  msg.textContent = 'remembered'

  const undo = document.createElement('button')
  undo.className = 'ps-undo'
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

function dismiss(): void {
  const wrap = host?.shadowRoot?.querySelector('.ps-wrap') as HTMLElement | null
  wrap?.replaceChildren()
}
