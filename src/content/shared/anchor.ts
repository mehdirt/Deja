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

const REPOSITION_THROTTLE_MS = 100

/**
 * Call `onMove` (throttled) whenever the anchor might have moved: scroll,
 * resize, or a layout change inside the composer. Returns an unsubscribe.
 *
 * `getRect` returning null means "the anchor is gone" — the caller decides
 * whether that means hide; we just stop asking.
 */
export function watchAnchor(getRect: () => DOMRect | null, onMove: () => void): () => void {
  let timer: number | undefined

  const schedule = () => {
    if (timer != null) return
    timer = window.setTimeout(() => {
      timer = undefined
      if (getRect()) onMove()
    }, REPOSITION_THROTTLE_MS)
  }

  // Capture phase so we also see scrolling inside the site's own containers,
  // not just the document.
  window.addEventListener('scroll', schedule, true)
  window.addEventListener('resize', schedule, true)

  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule, true)
  }
}

// ── Where the ambient dot sits ───────────────────────────────────────────────
//
// The dot should look like it belongs to the message box, which means sitting
// *inside* it, hugging a corner — the way every in-field affordance people
// already know does. An earlier version placed it outside the right edge to
// dodge each site's send button, and the result looked homeless: the selectors
// resolve to the editable itself, so "outside its right edge" is the wrapper's
// chrome, and every site leaves a different amount of it.
//
// Inside is right, but the corner can't be fixed: some sites overlay their own
// controls on the editable, and all five redesign regularly. So we try corners
// in order and take the first one that isn't sitting on something the site
// owns. That survives a redesign without anyone editing a constant.

export type DotCorner = 'bottom-right' | 'top-right' | 'top-left' | 'outside-right'

/** Corner order. Bottom-right first: it's the least-used part of a text box. */
const CORNERS: DotCorner[] = ['bottom-right', 'top-right', 'top-left', 'outside-right']

export interface Spot {
  left: number
  top: number
  corner: DotCorner
}

/** The top-left pixel for the dot in a given corner of `rect`. */
export function spotFor(rect: DOMRect, size: number, gap: number, corner: DotCorner): Spot {
  switch (corner) {
    case 'top-right':
      return { left: rect.right - size - gap, top: rect.top + gap, corner }
    case 'top-left':
      return { left: rect.left + gap, top: rect.top + gap, corner }
    case 'outside-right':
      return { left: rect.right + gap, top: rect.top + rect.height / 2 - size / 2, corner }
    case 'bottom-right':
    default:
      return { left: rect.right - size - gap, top: rect.bottom - size - gap, corner }
  }
}

/**
 * Pick the first corner whose square is free.
 *
 * `isOccupied` answers "is the host page already using this pixel for something
 * interactive?" — kept as a parameter so the geometry is pure and testable
 * without a DOM. `preferred` lets a site pin a corner outright when the
 * automatic answer is wrong there; it is tried first and still has to pass the
 * same check, so a pin can't put the dot on top of a send button.
 *
 * Falls back to the last candidate rather than returning nothing: a dot in a
 * slightly awkward place beats a dot that vanishes.
 */
export function pickSpot(
  rect: DOMRect,
  size: number,
  gap: number,
  isOccupied: (spot: Spot) => boolean,
  preferred?: DotCorner,
): Spot {
  const order = preferred ? [preferred, ...CORNERS.filter((c) => c !== preferred)] : CORNERS
  for (const corner of order) {
    const spot = spotFor(rect, size, gap, corner)
    if (!isOccupied(spot)) return spot
  }
  return spotFor(rect, size, gap, order[order.length - 1])
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
