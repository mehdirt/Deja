// The single source of truth for how Deja looks *inside* a host page.
//
// WHY THIS FILE EXISTS. Every in-page surface (the saved toast, the resurface
// tooltip, the ambient dot, its panel, the `//` picker, the blanks step) renders
// in a Shadow DOM so host-page CSS can't break us and our CSS can't leak out.
// The catch is `:host{all:initial}`: it blocks *inheritance* from the page,
// which also means the `--dj-*` variables declared in src/styles/globals.css
// never reach us. Historically each overlay solved that by hardcoding hexes per
// rule — two overlays meant two copies of the palette and one dark-mode media
// query per rule. Six overlays would have meant six copies drifting apart, and
// a half-applied dark mode is exactly the kind of bug nobody notices until a
// user screenshots it.
//
// The fix: declare the tokens *on :host* as custom properties. `all:initial`
// resets inherited values, but properties declared on the host element itself
// cascade into the shadow tree normally — so one media query covers the whole
// surface and light/dark can never disagree.
//
// MIRRORS src/styles/globals.css. When a token changes there, change it here in
// the same commit. There is no build-time link between the two files; there
// can't be one, because this string has to be injectable into a page we don't
// control.

/**
 * The palette, as `:host` custom properties, light + dark.
 *
 * `--dj-card` / `--dj-card-hover` are overlay-specific: an overlay floating on
 * someone else's page reads better on warm paper than on pure white, so light
 * mode uses the page-background token where the extension's own pages would use
 * `surface`. Dark mode uses surface, because the paper metaphor inverts.
 */
export const OVERLAY_TOKENS = `
:host{all:initial}
:host{
  --dj-card:#faf8f3;
  --dj-card-hover:#ebe6db;
  --dj-bg:#faf8f3;
  --dj-surface:#ffffff;
  --dj-sunk:#ebe6db;
  --dj-text:#1c1b19;
  --dj-text-soft:#534f49;
  --dj-text-faint:#655f56;
  --dj-accent:#5b54f0;
  --dj-accent-soft:#ecebfe;
  --dj-accent-hover:#4a43e0;
  /* Accent used as *text* on the card. Light mode can use the accent straight;
     dark mode needs the lighter step to stay readable on a dark card, which is
     why this is its own token rather than an alias of --dj-accent. */
  --dj-accent-text:#5b54f0;
  --dj-line:#d0caba;
  --dj-danger:#c0392b;
  --dj-ok:#2f9e63;
  --dj-warn:#935f16;
  --dj-shadow:0 8px 28px rgba(0,0,0,.18);
  --dj-font:13px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --dj-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){
  :host{
    --dj-card:#1e1d28;
    --dj-card-hover:#0c0b12;
    --dj-bg:#12111a;
    --dj-surface:#1e1d28;
    --dj-sunk:#0c0b12;
    --dj-text:#f3f1ea;
    --dj-text-soft:#b9b4a8;
    --dj-text-faint:#9a9488;
    --dj-accent:#8983f5;
    --dj-accent-soft:#2a2740;
    --dj-accent-hover:#9c97f7;
    --dj-accent-text:#9c97f7;
    --dj-line:#3f3c4a;
    --dj-danger:#e06c5d;
    --dj-ok:#56c98a;
    --dj-warn:#cf9550;
    --dj-shadow:0 8px 28px rgba(0,0,0,.4);
  }
}
`

/**
 * Primitives every overlay composes: the floating card, rows, buttons, the
 * focus ring, and the reduced-motion escape.
 *
 * Radii are deliberately tighter than DESIGN.md's 16px/11px pair — those are
 * for Deja's own pages, which can breathe. An overlay sitting on top of
 * somebody else's chat UI should read as a small utility, not a second app.
 */
export const OVERLAY_BASE = `
.dj-card{
  pointer-events:auto;background:var(--dj-card);color:var(--dj-text);
  border:1px solid var(--dj-line);border-radius:10px;box-shadow:var(--dj-shadow);
  font:var(--dj-font);text-align:left;box-sizing:border-box;
  animation:dj-in .14s ease-out;
}
.dj-card *,.dj-card *::before,.dj-card *::after{box-sizing:border-box}
.dj-btn{
  background:none;border:none;margin:0;cursor:pointer;color:inherit;font:inherit;
  border-radius:6px;padding:2px 5px;
}
.dj-btn:hover{background:var(--dj-card-hover)}
.dj-btn:focus-visible,.dj-row:focus-visible,.dj-input:focus-visible{
  outline:2px solid var(--dj-accent);outline-offset:1px;
}
.dj-x{
  flex:none;color:var(--dj-text-faint);font-weight:600;font-size:14px;line-height:1;
  padding:2px 5px;
}
.dj-x:hover{background:var(--dj-line);color:var(--dj-text)}
.dj-mono{font-family:var(--dj-mono);font-size:.92em}
.dj-nums{font-variant-numeric:tabular-nums}
@keyframes dj-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .dj-card{animation:none}
}
`

/** What a mounted overlay hands back to its owner. */
export interface OverlayHost {
  /** The fixed-position layer appended to <html>. */
  host: HTMLDivElement
  /** The closed root. Hold on to this — it is unreachable from the page. */
  shadow: ShadowRoot
  /** Re-append the layer if a host-page SPA navigation detached it. */
  reattach: () => void
  /** Remove the layer entirely. Safe to call twice. */
  destroy: () => void
}

/**
 * Mount a Shadow-DOM layer for one overlay, with the palette and primitives
 * already installed. `extraCss` is the surface's own rules.
 *
 * CLOSED ON PURPOSE. `attachShadow({mode:'open'})` leaves the rendered content
 * readable by any script on the host page via `element.shadowRoot`. That was a
 * narrow leak while the only thing on screen was a prompt the user had just
 * typed. It stops being narrow now that these surfaces render rows of the saved
 * library: a compromised third-party script on a chat site could otherwise
 * enumerate someone's whole prompt history. Closed roots cost us nothing (we
 * keep our own element references) except that DevTools shows `shadowRoot:
 * null` — that is expected, not a bug.
 *
 * The layer itself is `pointer-events:none` so the host page stays fully
 * clickable; only `.dj-card` opts back in.
 */
export function createOverlayHost(label: string, extraCss: string): OverlayHost {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  host.setAttribute('data-deja', label)

  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = OVERLAY_TOKENS + OVERLAY_BASE + extraCss
  shadow.appendChild(style)

  const reattach = () => {
    try {
      if (!host.isConnected) document.documentElement.appendChild(host)
    } catch {
      /* document gone mid-navigation — never throw into the host page */
    }
  }

  reattach()

  return {
    host,
    shadow,
    reattach,
    destroy() {
      try {
        host.remove()
      } catch {
        /* ignore */
      }
    },
  }
}

/**
 * True when an event came from a real person rather than `dispatchEvent`.
 *
 * Used to gate the two triggers that *open a surface reading the library* (the
 * dot's click, the `//` trigger). A hostile script on the host page can forge
 * events; if it could open the picker, it could make the extension type library
 * content into a field it controls and read it back.
 *
 * Deliberately NOT used on the capture path. Site frameworks legitimately emit
 * synthetic `input` events (ProseMirror, IME composition, paste handlers), and
 * refusing those would mean silently failing to save someone's prompt — a much
 * worse outcome than the risk it would close. Failing closed is only acceptable
 * where the fallback is graceful, and here it is: nothing opens, and the dot is
 * still there to click.
 */
export function isRealUserEvent(e: Event): boolean {
  return e.isTrusted === true
}
