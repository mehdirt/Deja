import { relativeTime } from '@/lib/format'
import { PLATFORM_COLOR, PLATFORM_LABEL, type LibraryRow } from '@/lib/types'

// One saved prompt, drawn as a row — shared by the dot's panel and the `//`
// picker, which are otherwise quite different surfaces.
//
// They started with a copy each, which was fine at two and would not be at
// three: Phase H adds more places that list prompts, and three near-identical
// row renderers is how the platform dot ends up a different size in one of
// them. The state machines stay separate (a panel with footer controls and an
// arrow-key-driven inline list are genuinely different things); only the
// drawing is shared.

export const LIBRARY_ROWS_CSS = `
.dj-list{list-style:none;margin:0;padding:5px;overflow-y:auto}
.dj-row{width:100%;display:block;text-align:left;border:none;background:none;cursor:pointer;
  padding:8px 9px;border-radius:8px;color:inherit;font:inherit}
.dj-row:hover{background:var(--dj-accent-soft)}
.dj-row[data-active="true"]{background:var(--dj-accent-soft);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dj-accent) 35%,transparent)}
.dj-row-text{font-size:12.5px;line-height:1.45;color:var(--dj-text);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dj-row-meta{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:10.5px;
  color:var(--dj-text-faint);font-variant-numeric:tabular-nums}
.dj-plat{display:inline-flex;align-items:center;gap:4px}
.dj-plat i{width:7px;height:7px;border-radius:50%;display:block;
  box-shadow:inset 0 0 0 1px var(--dj-line)}
.dj-note{padding:16px 12px;font-size:12.5px;color:var(--dj-text-faint);text-align:center}
.dj-skel{padding:8px 9px}
.dj-skel-bar{height:9px;border-radius:5px;background:var(--dj-sunk);margin-bottom:6px}
.dj-skel-bar:last-child{width:55%;margin-bottom:0}
`

/** A clickable row for one saved prompt. */
export function renderRow(row: LibraryRow, onChoose: () => void): HTMLLIElement {
  const li = document.createElement('li')
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'dj-row'

  const text = document.createElement('div')
  text.className = 'dj-row-text'
  text.textContent = row.text.replace(/\s+/g, ' ').trim()

  const meta = document.createElement('div')
  meta.className = 'dj-row-meta'
  const plat = document.createElement('span')
  plat.className = 'dj-plat'
  const swatch = document.createElement('i')
  swatch.style.background = PLATFORM_COLOR[row.platform]
  plat.append(swatch, document.createTextNode(PLATFORM_LABEL[row.platform]))
  meta.append(
    plat,
    document.createTextNode('·'),
    document.createTextNode(relativeTime(row.lastUsedAt)),
  )
  if (row.usageCount > 0) {
    meta.append(document.createTextNode('·'), document.createTextNode(`used ${row.usageCount}×`))
  }

  btn.append(text, meta)
  // Keep the caret where it is — we're about to write to that field.
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  btn.addEventListener('click', onChoose)
  li.appendChild(btn)
  return li
}

/** Replace the list with a single quiet line (empty state, or a failure). */
export function renderNote(list: HTMLElement, text: string): void {
  list.replaceChildren()
  const li = document.createElement('li')
  const note = document.createElement('div')
  note.className = 'dj-note'
  note.textContent = text
  li.appendChild(note)
  list.appendChild(li)
}

/**
 * Placeholder rows while the worker wakes up.
 *
 * Only worth showing if the wait is real — see the callers' delay before this
 * is called. A skeleton that flashes for 20ms reads as a glitch, not as loading.
 */
export function renderSkeleton(list: HTMLElement, count = 3): void {
  list.replaceChildren()
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li')
    li.className = 'dj-skel'
    li.setAttribute('aria-hidden', 'true')
    const a = document.createElement('div')
    a.className = 'dj-skel-bar'
    const b = document.createElement('div')
    b.className = 'dj-skel-bar'
    li.append(a, b)
    list.appendChild(li)
  }
}
