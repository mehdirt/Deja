// Positioning for in-page overlays: put a floating card next to the composer
// and keep it there while the page scrolls, resizes, or reflows.
//
// Extracted from resurface.ts, which had this inline. Four surfaces need it
// now (tooltip, panel, picker, blanks step) and viewport clamping is exactly
// the kind of thing that gets subtly re-implemented four different ways.

/** Where the card sits relative to its anchor. */
export type AnchorSide =
  /** Above the anchor, left-aligned. Flips below when there's no room. */
  | 'above'
  /** Below the anchor, left-aligned. Flips above when there's no room. */
  | 'below'
  /** Outside the anchor's right edge, bottom-aligned. */
  | 'right-outside'
  /** Inside the anchor's bottom-right corner — the tight-viewport fallback. */
  | 'inside-bottom-right'

const MARGIN = 8

/**
 * Place `card` relative to `rect`. The card must already be *shown* (we measure
 * it), which in practice means the caller removes its `hidden` attribute first.
 * We hide it via `visibility` — not `display` — during measurement so it never
 * flashes in the wrong place, and never loses its layout mode.
 */
export function anchorTo(
  card: HTMLElement,
  rect: DOMRect,
  side: AnchorSide,
  gap = MARGIN,
): void {
  const prevVisibility = card.style.visibility
  card.style.visibility = 'hidden'

  const h = card.offsetHeight || 44
  const w = card.offsetWidth || 320

  let top: number
  let left: number

  switch (side) {
    case 'right-outside':
      top = rect.bottom - h
      left = rect.right + gap
      // No room to the right of the composer — tuck into its corner instead.
      if (left + w > window.innerWidth - MARGIN) {
        left = rect.right - w - gap
        top = rect.bottom - h - gap
      }
      break

    case 'inside-bottom-right':
      top = rect.bottom - h - gap
      left = rect.right - w - gap
      break

    case 'below':
      top = rect.bottom + gap
      left = rect.left
      if (top + h > window.innerHeight - MARGIN) top = rect.top - h - gap
      break

    case 'above':
    default:
      top = rect.top - h - gap
      left = rect.left
      if (top < MARGIN) top = rect.bottom + gap // flip below
      break
  }

  const maxLeft = window.innerWidth - w - MARGIN
  if (left > maxLeft) left = Math.max(MARGIN, maxLeft)
  if (left < MARGIN) left = MARGIN
  if (top < MARGIN) top = MARGIN

  card.style.position = 'fixed'
  card.style.left = `${left}px`
  card.style.top = `${top}px`
  card.style.visibility = prevVisibility || 'visible'
}

/**
 * Call `onMove` (coalesced to animation frames) whenever the anchor might have
 * moved: scroll, resize, field resize, or a layout change. Returns an unsubscribe.
 *
 * `getRect` returning null means "the anchor is gone" — the caller decides
 * whether that means hide; we just stop asking.
 *
 * Pass `observeEl` (the composer field) so a ResizeObserver catches the box
 * growing as the person types — scroll/window listeners alone miss that.
 */
export function watchAnchor(
  getRect: () => DOMRect | null,
  onMove: () => void,
  observeEl?: () => HTMLElement | null,
): () => void {
  let raf = 0
  let timer: number | undefined
  let ro: ResizeObserver | null = null
  let observed: HTMLElement | null = null

  const syncObserver = () => {
    const el = observeEl?.() ?? null
    if (el === observed) return
    if (ro && observed) {
      try {
        ro.unobserve(observed)
      } catch {
        /* already gone */
      }
    }
    observed = el
    if (!el || typeof ResizeObserver === 'undefined') return
    ro ??= new ResizeObserver(() => schedule())
    ro.observe(el)
  }

  const run = () => {
    syncObserver()
    if (getRect()) onMove()
  }

  const schedule = () => {
    // Scroll/resize: next paint. Other signals: short timeout fallback when
    // rAF isn't enough (e.g. font load) — still far tighter than 100ms.
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 0)
    })
  }

  // Capture phase so we also see scrolling inside the site's own containers,
  // not just the document.
  window.addEventListener('scroll', schedule, true)
  window.addEventListener('resize', schedule, true)
  syncObserver()

  return () => {
    if (raf) cancelAnimationFrame(raf)
    window.clearTimeout(timer)
    window.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule, true)
    ro?.disconnect()
    ro = null
    observed = null
  }
}
// ── Where the ambient dot sits ───────────────────────────────────────────────
//
// Screenshots (2026-08-11): Claude/DeepSeek showed the mark at the *text
// row's* bottom-right — on a tall card that reads as the card's top-right.
// DeepSeek's earlier "good" state was left-of-Send at the bottom toolbar.
//
// Rule that matches every site:
//   1. Resolve the visual composer **shell** (form / flex-grid card).
//   2. Sit **left of the end action** (Send / Voice / mic), centred on it.
//   3. Else shell bottom-right. Never hug the skinny editable alone on
//      multi-row composers — that parks the mark in the wrong visual corner.

export type DotCorner = 'bottom-right' | 'top-right' | 'top-left' | 'outside-right'

/** How to resolve the box we hug. */
export type DotMode = 'auto' | 'beside-send' | 'field'

export interface Spot {
  left: number
  top: number
  corner: DotCorner
}

export interface DotPlacement {
  mode?: DotMode
  corner?: DotCorner
  /** Gap between mark and Send / shell edge. */
  gap?: number
  /** Nudge after placement — site chrome quirks. */
  offset?: { x?: number; y?: number }
  /** Site-specific Send / end-action selectors. */
  sendSelectors?: string[]
  /** Override shell resolution (rare). */
  getShell?: (input: HTMLElement) => HTMLElement | null
  /** @deprecated Field hug parks wrong on tall cards; prefer beside-send. */
  getField?: (input: HTMLElement) => HTMLElement | null
}

/** Default gap from the end action / shell edge. */
export const FIELD_INSET = 8

/** Step when sliding left to clear a control. */
const SLIDE_STEP = 6

const DEFAULT_SEND_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[data-testid="composer-send-button"]',
  'button[data-testid="composer-speech-button"]',
  'button[aria-label*="Send" i]',
  'button[aria-label*="Submit" i]',
  'button[aria-label*="Voice" i]',
  'button[aria-label*="Microphone" i]',
  'button[aria-label*="Dictate" i]',
  'button[aria-label*="speech" i]',
  'button[type="submit"]',
  // Claude / Gemini sometimes put voice on a non-button control.
  '[aria-label*="Dictate" i]',
  '[aria-label*="Microphone" i]',
  '[aria-label*="Voice" i]',
  '[aria-label*="Open voice" i]',
]

/** Labels that count as the composer end action (Send / mic / voice). */
const END_ACTION_RE = /\b(send|submit|voice|mic|microphone|dictat|speech|waveform)\b/i

/**
 * Client box of an element in viewport coords: content + padding, excluding
 * border and scrollbar.
 */
export function fieldBox(el: HTMLElement): DOMRect | null {
  try {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null
    const style = getComputedStyle(el)
    const bl = parseFloat(style.borderLeftWidth) || 0
    const bt = parseFloat(style.borderTopWidth) || 0
    const w = el.clientWidth
    const h = el.clientHeight
    if (w <= 0 || h <= 0) return rect
    return new DOMRect(rect.left + bl, rect.top + bt, w, h)
  } catch {
    return null
  }
}

/**
 * The visual composer shell around the editable — the card/bar that also
 * holds Send / mic / toolbar.
 *
 * Pick the *tightest* ancestor that still holds controls and is wider/taller
 * than the field. Grok's real pill is ~composer-width; the wrapping `<form>`
 * is nearly full viewport — using that parks the mark off-screen to the right.
 */
export function resolveComposerShell(input: HTMLElement): HTMLElement {
  let best = input
  let bestWidth = Infinity
  let inputRect: DOMRect
  try {
    inputRect = input.getBoundingClientRect()
  } catch {
    return input
  }

  // Cap by field width, not viewport % — wide monitors made Grok's full-bleed
  // form look "narrow enough" and parked the mark off the right of the pill.
  // +360 covers Gemini/Claude chrome (model chip + mic) beside the editable.
  const maxShellWidth = Math.min(window.innerWidth * 0.88, inputRect.width + 360)

  let el: HTMLElement | null = input.parentElement
  for (let i = 0; i < 10 && el; i++, el = el.parentElement) {
    let r: DOMRect
    try {
      r = el.getBoundingClientRect()
    } catch {
      break
    }
    if (r.width === 0 || r.height === 0) continue
    if (r.width > window.innerWidth * 0.96 || r.height > window.innerHeight * 0.55) break

    let hasControls = false
    try {
      hasControls = !!el.querySelector('button, [role="button"], [type="submit"]')
    } catch {
      hasControls = false
    }
    if (!hasControls) continue

    const wider = r.width >= inputRect.width + 20
    const taller = r.height >= inputRect.height + 12
    if (!(wider || taller)) continue
    if (r.width > maxShellWidth) {
      // Too wide (full-bleed form) — keep climbing only if we have nothing yet.
      if (el.tagName === 'FORM') break
      continue
    }

    // Tightest suitable ancestor wins.
    if (r.width < bestWidth) {
      best = el
      bestWidth = r.width
    }

    if (el.tagName === 'FORM') break
  }
  return best
}

/** Model pickers / text chips — not the end action we want to sit beside. */
export function isChromeControl(el: HTMLElement): boolean {
  const role = el.getAttribute('role') || ''
  if (role === 'combobox' || role === 'listbox') return true
  const raw = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim()
  if (!raw) return false
  if (
    /\b(Sonnet|Opus|Haiku|Flash|Fast|Lite|Medium|Thinking|Plus|Upgrade|Attach|Search|DeepThink)\b/i.test(
      raw,
    )
  ) {
    // "Flash" / "Fast" in a Send label would be exotic; still allow real end actions.
    if (END_ACTION_RE.test(raw)) return false
    return true
  }
  if (/\bmodel\s*select\b/i.test(raw)) return true
  if (/\bmode\s*picker\b/i.test(raw)) return true
  if (/\bcurrently\s+(Flash|Sonnet|Opus|Haiku|Fast|Lite)\b/i.test(raw)) return true
  // Icon-only end actions are short; "Sonnet 5 Medium" / "Flash" are longer.
  if (raw.length > 18 && !END_ACTION_RE.test(raw)) return true
  return false
}

function controlLabel(el: HTMLElement): string {
  return `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.replace(/\s+/g, ' ').trim()
}

/**
 * Find the end action (Send / Voice / rightmost bottom control) inside the
 * shell — never the editable itself, never the model picker.
 */
export function findSendControl(
  shell: HTMLElement,
  input: HTMLElement,
  selectors: string[] = DEFAULT_SEND_SELECTORS,
): HTMLElement | null {
  let shellRect: DOMRect
  try {
    shellRect = shell.getBoundingClientRect()
  } catch {
    return null
  }

  // Prefer the *rightmost* selector hit — first-match ordered lists used to
  // grab an earlier chrome control when labels overlapped poorly.
  let bestHit: HTMLElement | null = null
  let bestHitRight = -Infinity
  for (const sel of selectors) {
    try {
      const nodes = shell.querySelectorAll(sel)
      for (const hit of nodes) {
        if (!(hit instanceof HTMLElement) || input.contains(hit) || hit === input) continue
        if (isChromeControl(hit)) continue
        const r = hit.getBoundingClientRect()
        if (r.width < 8 || r.height < 8) continue
        if (r.right > bestHitRight) {
          bestHitRight = r.right
          bestHit = hit
        }
      }
    } catch {
      /* bad selector — skip */
    }
  }
  if (bestHit) return bestHit

  const midY = shellRect.top + shellRect.height * 0.4
  // End actions hug the right half of the pill (not a fixed 120px — that
  // failed when a wrong wide shell made nearRight sit past the real controls).
  const nearRight = shellRect.left + shellRect.width * 0.55

  let best: HTMLElement | null = null
  let bestScore = -Infinity
  let nodes: NodeListOf<Element>
  try {
    nodes = shell.querySelectorAll('button, [role="button"], [type="submit"], [aria-label]')
  } catch {
    return null
  }
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue
    if (input.contains(node) || node === input) continue
    if (isChromeControl(node)) continue
    const r = node.getBoundingClientRect()
    if (r.width < 8 || r.height < 8 || r.width > 120) continue
    if (r.right < nearRight) continue
    const cy = r.top + r.height / 2
    if (shellRect.height > 64 && cy < midY) continue
    const label = controlLabel(node)
    const endBonus = END_ACTION_RE.test(label) ? 1_000_000 : 0
    const score = endBonus + r.right * 1000 + r.bottom
    if (score > bestScore) {
      bestScore = score
      best = node
    }
  }
  return best
}

/** Park immediately left of a control, vertically centred on it. */
export function spotBesideControl(control: DOMRect, size: number, gap: number): Spot {
  return {
    left: control.left - size - gap,
    top: control.top + (control.height - size) / 2,
    corner: 'bottom-right',
  }
}

/** The top-left pixel for the dot in a given corner of a rect. */
export function spotFor(rect: DOMRect, size: number, gap: number, corner: DotCorner): Spot {
  switch (corner) {
    case 'top-right':
      return { left: rect.right - size - gap, top: rect.top + gap, corner }
    case 'top-left':
      return { left: rect.left + gap, top: rect.top + gap, corner }
    case 'outside-right':
      return { left: rect.right + gap, top: rect.bottom - size - gap, corner }
    case 'bottom-right':
    default:
      return { left: rect.right - size - gap, top: rect.bottom - size - gap, corner }
  }
}

/** Bottom-right of a rect, sliding left if occupied. */
export function pickSpot(
  rect: DOMRect,
  size: number,
  gap: number,
  isOccupied: (spot: Spot) => boolean,
  preferred?: DotCorner,
): Spot {
  const start = preferred ?? 'bottom-right'

  if (start === 'outside-right') {
    const outside = spotFor(rect, size, gap, 'outside-right')
    if (!isOccupied(outside)) return outside
  }

  if (start === 'top-left' || start === 'top-right') {
    const pinned = spotFor(rect, size, gap, start)
    if (!isOccupied(pinned)) return pinned
  }

  const top = rect.bottom - size - gap
  const minLeft = rect.left + gap
  let left = rect.right - size - gap
  while (left >= minLeft - 0.5) {
    const spot: Spot = { left, top, corner: 'bottom-right' }
    if (!isOccupied(spot)) return spot
    left -= SLIDE_STEP
  }

  return spotFor(rect, size, gap, 'outside-right')
}

function applyOffset(spot: Spot, offset?: { x?: number; y?: number }): Spot {
  if (!offset) return spot
  return {
    ...spot,
    left: spot.left + (offset.x ?? 0),
    top: spot.top + (offset.y ?? 0),
  }
}

/**
 * Place the mark left of Send/Voice on the composer shell (screenshot-driven).
 * Field-only hug is the escape hatch — it parks wrong on tall cards.
 */
export function pickComposerSpot(
  input: HTMLElement,
  size: number,
  isOccupied: (spot: Spot) => boolean,
  placement: DotPlacement = {},
): Spot {
  const gap = placement.gap ?? FIELD_INSET
  const mode = placement.mode ?? 'auto'
  const shell = placement.getShell?.(input) ?? resolveComposerShell(input)

  const tryBesideSend = (): Spot | null => {
    const send = findSendControl(shell, input, placement.sendSelectors ?? DEFAULT_SEND_SELECTORS)
    if (!send) return null
    let sendRect: DOMRect
    let shellRect: DOMRect
    try {
      sendRect = send.getBoundingClientRect()
      shellRect = shell.getBoundingClientRect()
    } catch {
      return null
    }

    // Sit immediately left of the end action. Do NOT slide further left when
    // a model chip (Sonnet/Flash) overlaps that square — sliding left is what
    // parked the mark beside the chip instead of the mic on Claude/Gemini.
    let spot = spotBesideControl(sendRect, size, gap)
    if (spot.left < shellRect.left + 2) {
      spot = { ...spot, left: shellRect.left + 2 }
    }
    // Keep inside the shell's right padding so we never spill off the pill.
    const maxLeft = shellRect.right - size - 4
    if (spot.left > maxLeft) spot = { ...spot, left: Math.max(shellRect.left + 2, maxLeft) }
    if (spot.top + size < shellRect.top - 4 || spot.top > shellRect.bottom + 4) return null
    return spot
  }

  const tryShellEnd = (): Spot => {
    const box = fieldBox(shell) ?? shell.getBoundingClientRect()
    // Pin shell BR — do NOT slide left. Sliding is what parked the mark left
    // of Sonnet/Flash when mic wasn't found as a button (Claude/Gemini).
    return spotFor(box, size, gap, placement.corner ?? 'bottom-right')
  }

  const tryField = (): Spot => {
    const fieldEl = placement.getField?.(input) ?? input
    const box = fieldBox(fieldEl) ?? fieldEl.getBoundingClientRect()
    return pickSpot(box, size, gap, isOccupied, placement.corner)
  }

  if (mode === 'field') {
    return applyOffset(tryField(), placement.offset)
  }

  // auto + beside-send: left of end action, else shell bottom-right.
  const beside = tryBesideSend()
  if (beside) return applyOffset(beside, placement.offset)
  return applyOffset(tryShellEnd(), placement.offset)
}

/** The anchor's box, or null when it's gone / collapsed to nothing. */
export function rectOf(el: HTMLElement | null): DOMRect | null {
  if (!el) return null
  try {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return r
  } catch {
    return null
  }
}
