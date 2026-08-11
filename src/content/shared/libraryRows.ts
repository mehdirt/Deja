import { relativeTime } from '@/lib/format'
import { PLATFORM_COLOR, PLATFORM_LABEL, type LibraryRow } from '@/lib/types'

// One saved prompt, drawn as a row — shared by the dot's panel and the `//`
// picker. Shaped like a miniature Library PromptCard: always-visible border,
// platform chip, readable body, quiet meta.

export const LIBRARY_ROWS_CSS = `
.dj-list{list-style:none;margin:0;padding:6px;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.dj-row{width:100%;display:flex;flex-direction:column;gap:8px;text-align:left;
  border:1px solid var(--dj-line);background:var(--dj-surface);cursor:pointer;
  padding:12px 13px;border-radius:12px;color:inherit;font:inherit;
  box-shadow:var(--dj-shadow-sm);
  transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s cubic-bezier(0.16,1,0.3,1)}
.dj-row:hover{border-color:color-mix(in srgb,var(--dj-accent) 22%,var(--dj-line));
  transform:translateY(-1px);
  box-shadow:0 1px 2px rgba(28,27,25,.04),0 8px 20px rgba(28,27,25,.08)}
.dj-row[data-active="true"]{background:color-mix(in srgb,var(--dj-accent-soft) 70%,var(--dj-surface));
  border-color:color-mix(in srgb,var(--dj-accent) 35%,var(--dj-line));transform:none}
.dj-row-text{font-size:14px;line-height:1.55;color:var(--dj-text);
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  letter-spacing:-0.01em}
.dj-row-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-size:11px;color:var(--dj-text-faint);font-variant-numeric:tabular-nums}
.dj-plat{display:inline-flex;align-items:center;gap:5px;
  border-radius:999px;padding:2px 8px;font-size:11px;font-weight:500;
  background:var(--dj-accent-soft);color:var(--dj-accent-text)}
.dj-plat i{width:6px;height:6px;border-radius:50%;display:block;flex:none;
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dj-line) 70%,transparent)}
.dj-note{padding:28px 18px;font-size:13.5px;line-height:1.55;color:var(--dj-text-soft);text-align:center}
.dj-note strong{display:block;margin-bottom:4px;font-weight:600;color:var(--dj-text)}
.dj-skel{padding:12px 13px;border-radius:12px;border:1px solid var(--dj-line);background:var(--dj-surface)}
.dj-skel-bar{height:10px;border-radius:6px;background:var(--dj-sunk);margin-bottom:8px}
.dj-skel-bar:last-child{width:48%;margin-bottom:0;height:8px}
@media (prefers-reduced-motion: reduce){
  .dj-row:hover{transform:none}
}
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
  const color = PLATFORM_COLOR[row.platform]
  swatch.style.background = color
  if (color.toLowerCase() === '#fff' || color.toLowerCase() === '#ffffff') {
    swatch.style.boxShadow = 'inset 0 0 0 1px var(--dj-line)'
  }
  plat.append(swatch, document.createTextNode(PLATFORM_LABEL[row.platform]))
  meta.append(plat, document.createTextNode(relativeTime(row.lastUsedAt)))

  btn.append(text, meta)
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  btn.addEventListener('click', onChoose)
  li.appendChild(btn)
  return li
}

/** Replace the list with a quiet empty / error state. */
export function renderNote(list: HTMLElement, text: string): void {
  list.replaceChildren()
  const li = document.createElement('li')
  const note = document.createElement('div')
  note.className = 'dj-note'
  // Two-line empty states read warmer when the first sentence is the lead.
  const parts = text.split(' — ')
  if (parts.length === 2) {
    const strong = document.createElement('strong')
    strong.textContent = parts[0]
    note.append(strong, document.createTextNode(parts[1]))
  } else {
    note.textContent = text
  }
  li.appendChild(note)
  list.appendChild(li)
}

/** Placeholder rows while the worker wakes up. */
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
