import { blankLabel, fillTemplate, findPlaceholders } from '@/lib/template'

// The fill-in-the-blank step, rendered inside whichever in-page surface asked
// for it (the dot's panel or the `//` picker). Shared so the two can never
// drift into slightly different ideas of what a blank is.
//
// This is a *view*, not a widget with its own Shadow DOM: the caller passes the
// element to render into and gets back a small handle. That keeps focus
// management in one place (the surface that owns the dialog) and means the
// blanks step inherits the same palette and closed root as its host.
//
// The reuse pattern for everyday users is "same shape, different details", so
// this is the step that turns a saved prompt into a reusable one. It is skipped
// entirely for prompts with no blanks — never show someone an empty form.

export const BLANKS_CSS = `
.dj-fill{padding:11px 12px;display:flex;flex-direction:column;gap:9px}
.dj-fill-lead{margin:0;font-size:12px;color:var(--dj-text-soft)}
.dj-fill-preview{font-size:12.5px;line-height:1.5;background:var(--dj-sunk);
  border-radius:8px;padding:8px 10px;color:var(--dj-text-soft);
  max-height:78px;overflow:hidden}
.dj-fill-preview b{font-family:var(--dj-mono);font-weight:500;font-size:.92em;color:var(--dj-accent-text)}
.dj-fill-field{display:flex;flex-direction:column;gap:3px}
.dj-fill-field label{font-family:var(--dj-mono);font-size:11px;color:var(--dj-text-faint)}
.dj-input{border:1px solid var(--dj-line);border-radius:8px;padding:7px 9px;
  font:inherit;font-size:12.5px;background:var(--dj-bg);color:var(--dj-text);width:100%}
.dj-input:focus{outline:none;border-color:var(--dj-accent)}
.dj-input:focus-visible{outline:2px solid var(--dj-accent);outline-offset:1px}
.dj-fill-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:2px}
.dj-mini{border:1px solid var(--dj-line);background:var(--dj-surface);border-radius:8px;
  padding:5px 11px;font:inherit;font-size:12px;font-weight:500;cursor:pointer;color:var(--dj-text)}
.dj-mini:hover{background:var(--dj-sunk)}
.dj-mini-primary{background:var(--dj-accent);border-color:var(--dj-accent);color:#fff;font-weight:600}
.dj-mini-primary:hover{background:var(--dj-accent-hover)}
`

export interface BlanksHandle {
  /** Move focus into the first field. */
  focus: () => void
}

export interface BlanksOptions {
  text: string
  /** Called with the completed text when the user commits. */
  onDone: (filled: string) => void
  /** Called when the user backs out. */
  onCancel: () => void
}

/** True when this prompt has anything worth filling in. */
export function hasBlanks(text: string): boolean {
  return findPlaceholders(text).length > 0
}

/**
 * Render the fill-in step into `container` (which is cleared first).
 *
 * Empty fields are left as their original blank rather than replaced with an
 * empty string — someone who fills two of three blanks gets a prompt with one
 * blank left in it, which they can finish in the chat box. Silently deleting
 * the token would leave a sentence with a hole in it and no sign of why.
 */
export function renderBlanks(container: HTMLElement, opts: BlanksOptions): BlanksHandle {
  container.replaceChildren()

  const blanks = findPlaceholders(opts.text)
  const wrap = document.createElement('div')
  wrap.className = 'dj-fill'

  const lead = document.createElement('p')
  lead.className = 'dj-fill-lead'
  lead.textContent = 'Fill these in and Deja puts the finished prompt in the box.'
  wrap.appendChild(lead)

  // Preview with the blanks called out, built by splitting on the tokens —
  // never by setting innerHTML, because this text came from a web page.
  const preview = document.createElement('div')
  preview.className = 'dj-fill-preview'
  appendWithTokens(preview, opts.text, blanks.map((b) => b.token))
  wrap.appendChild(preview)

  const inputs: Array<{ name: string; input: HTMLInputElement }> = []
  blanks.forEach((b, i) => {
    const field = document.createElement('div')
    field.className = 'dj-fill-field'
    const id = `dj-blank-${i}`
    const label = document.createElement('label')
    label.htmlFor = id
    label.textContent = blankLabel(b.name)
    const input = document.createElement('input')
    input.type = 'text'
    input.id = id
    input.className = 'dj-input'
    input.placeholder = 'Type what goes here'
    field.append(label, input)
    wrap.appendChild(field)
    inputs.push({ name: b.name, input })
  })

  const commit = () => {
    const values: Record<string, string> = {}
    for (const f of inputs) {
      const v = f.input.value.trim()
      if (v) values[f.name] = v
    }
    opts.onDone(fillTemplate(opts.text, values))
  }

  // Enter anywhere in the form commits — the form is short and every field is
  // optional, so there's nothing to validate first.
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
  })

  const actions = document.createElement('div')
  actions.className = 'dj-fill-actions'

  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'dj-mini'
  back.textContent = 'Back'
  back.addEventListener('mousedown', (e) => e.preventDefault())
  back.addEventListener('click', opts.onCancel)

  const go = document.createElement('button')
  go.type = 'button'
  go.className = 'dj-mini dj-mini-primary'
  go.textContent = 'Put it in the box'
  go.addEventListener('mousedown', (e) => e.preventDefault())
  go.addEventListener('click', commit)

  actions.append(back, go)
  wrap.appendChild(actions)
  container.appendChild(wrap)

  return {
    focus: () => inputs[0]?.input.focus(),
  }
}

/** Append `text` to `parent`, wrapping each token occurrence in a <b>. */
function appendWithTokens(parent: HTMLElement, text: string, tokens: string[]): void {
  if (!tokens.length) {
    parent.textContent = text
    return
  }
  // Longest first so "[email_1]" wins over a hypothetical "[email]" prefix.
  const ordered = [...tokens].sort((a, b) => b.length - a.length)
  let rest = text
  let guard = 0
  while (rest && guard++ < 500) {
    let bestAt = -1
    let bestToken = ''
    for (const t of ordered) {
      const at = rest.indexOf(t)
      if (at !== -1 && (bestAt === -1 || at < bestAt)) {
        bestAt = at
        bestToken = t
      }
    }
    if (bestAt === -1) break
    if (bestAt > 0) parent.appendChild(document.createTextNode(rest.slice(0, bestAt)))
    const b = document.createElement('b')
    b.textContent = bestToken
    parent.appendChild(b)
    rest = rest.slice(bestAt + bestToken.length)
  }
  if (rest) parent.appendChild(document.createTextNode(rest))
}
