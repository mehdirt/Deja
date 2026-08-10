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
