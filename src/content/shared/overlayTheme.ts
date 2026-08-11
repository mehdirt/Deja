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
// MIRRORS src/styles/globals.css *and* the library / landing card language
// (surface cards, 14–16px radii, soft pop shadow, accent-border hover). When a
// token changes there, change it here in the same commit. There is no build-time
// link between the two files; there can't be one, because this string has to be
// injectable into a page we don't control.
//
// Fonts stay the system UI stack on purpose for body UI: an overlay on
// chatgpt.com should sit quietly on that page. The one exception is the
// lowercase `deja` wordmark — that always uses bundled Literata (loaded via
// chrome.runtime.getURL into the closed shadow tree).

/**
 * Literata @font-face rules for the wordmark, pointed at extension URLs.
 *
 * Returns empty when the runtime isn't available (unit tests, orphaned
 * content scripts) — `.dj-wordmark` still falls back to Georgia.
 */
export function brandFontFaces(): string {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return ''
    const semi = chrome.runtime.getURL('fonts/literata-semibold.woff2')
    const bold = chrome.runtime.getURL('fonts/literata-bold.woff2')
    return `
@font-face{font-family:'Literata';font-style:normal;font-display:swap;font-weight:600;src:url('${semi}') format('woff2')}
@font-face{font-family:'Literata';font-style:normal;font-display:swap;font-weight:700;src:url('${bold}') format('woff2')}
`
  } catch {
    return ''
  }
}

/**
 * The palette, as `:host` custom properties, light + dark.
 *
 * Cards use `--dj-surface` (raised white / night surface), matching Library
 * `.dj-card` and the landing flow-steps — not warm paper. Paper is the page
 * behind the cards; floating on someone else's site, the raised card is the
 * right metaphor.
 */
export const OVERLAY_TOKENS = `
:host{all:initial}
:host{
  --dj-bg:#faf8f3;
  --dj-surface:#ffffff;
  --dj-sunk:#ebe6db;
  --dj-text:#1c1b19;
  --dj-text-soft:#534f49;
  --dj-text-faint:#655f56;
  --dj-accent:#5b54f0;
  --dj-accent-soft:#ecebfe;
  --dj-accent-hover:#4a43e0;
  --dj-accent-text:#5b54f0;
  --dj-line:#d0caba;
  --dj-danger:#c0392b;
  --dj-ok:#2f9e63;
  --dj-warn:#935f16;
  /* Match landing --shadow-pop / library overlays, not a harsh drop. */
  --dj-shadow:0 1px 2px rgba(28,27,25,.04),0 16px 44px rgba(28,27,25,.14);
  --dj-shadow-sm:0 1px 2px rgba(28,27,25,.04),0 1px 3px rgba(28,27,25,.06);
  --dj-shadow-cta:0 8px 22px rgba(91,84,240,.22);
  --dj-radius-card:16px;
  --dj-radius-btn:11px;
  --dj-radius-row:12px;
  --dj-font:13.5px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --dj-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --dj-font-brand:'Literata',Georgia,'Times New Roman',serif;
}
@media (prefers-color-scheme: dark){
  :host{
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
    --dj-shadow:0 1px 2px rgba(0,0,0,.2),0 16px 44px rgba(0,0,0,.45);
    --dj-shadow-sm:0 1px 2px rgba(0,0,0,.2),0 1px 3px rgba(0,0,0,.28);
    --dj-shadow-cta:0 8px 22px rgba(137,131,245,.28);
  }
}
`

/**
 * Primitives every overlay composes — shaped like Library / landing, denser.
 *
 * `.dj-card` ≈ library card + landing flow-step (surface, soft shadow, accent
 * border on hover). `.dj-btn` / `.dj-mini` ≈ `.dj-btn` / primary. `.dj-chip`
 * matches platform chips on PromptCard.
 */
export const OVERLAY_BASE = `
.dj-card{
  pointer-events:auto;background:var(--dj-surface);color:var(--dj-text);
  border:1px solid var(--dj-line);border-radius:var(--dj-radius-card);
  box-shadow:var(--dj-shadow);font:var(--dj-font);text-align:left;box-sizing:border-box;
  animation:dj-in .2s cubic-bezier(0.16,1,0.3,1);
}
.dj-card *,.dj-card *::before,.dj-card *::after{box-sizing:border-box}
.dj-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:4px;
  background:none;border:1px solid transparent;margin:0;cursor:pointer;color:inherit;
  font:inherit;border-radius:var(--dj-radius-btn);padding:4px 8px;
  transition:background-color .15s ease,border-color .15s ease,color .15s ease,transform .12s ease;
}
.dj-btn:hover{background:var(--dj-sunk)}
.dj-btn:active{transform:scale(.98)}
.dj-btn:focus-visible,.dj-row:focus-visible,.dj-input:focus-visible,.dj-search:focus-visible{
  outline:2px solid var(--dj-accent);outline-offset:1px;
}
.dj-x{
  flex:none;color:var(--dj-text-faint);font-weight:600;font-size:15px;line-height:1;
  padding:4px 7px;border-radius:8px;
}
.dj-x:hover{background:var(--dj-sunk);color:var(--dj-text)}
.dj-chip{
  display:inline-flex;align-items:center;gap:5px;
  border-radius:999px;padding:2px 8px;font-size:11px;font-weight:500;
  background:var(--dj-accent-soft);color:var(--dj-accent-text);
}
.dj-mono{font-family:var(--dj-mono);font-size:.92em}
.dj-nums{font-variant-numeric:tabular-nums}
.dj-meta{font-size:11px;color:var(--dj-text-faint);font-variant-numeric:tabular-nums}
/* Lowercase deja wordmark — Literata only, same as Library / landing. */
.dj-wordmark{font-family:var(--dj-font-brand);font-weight:600;font-size:15px;
  letter-spacing:-0.02em;line-height:1.1;color:var(--dj-text)}
.dj-wordmark .ja{color:var(--dj-accent-text)}
@keyframes dj-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
  .dj-card{animation:none}
  .dj-btn:active{transform:none}
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
 * clickable; only `.dj-card` (and the ambient dot) opts back in.
 */
export function createOverlayHost(label: string, extraCss: string): OverlayHost {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  host.setAttribute('data-deja', label)

  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = brandFontFaces() + OVERLAY_TOKENS + OVERLAY_BASE + extraCss
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
