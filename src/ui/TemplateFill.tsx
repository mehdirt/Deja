import { useMemo, useState } from 'react'
import { fillTemplate, findPlaceholders } from '@/lib/template'

interface Props {
  text: string
  /** Called with the finished prompt when the user confirms. */
  onFilled: (text: string) => void
  onCancel: () => void
}

// The form that appears when you reuse a prompt with blanks in it. One field
// per blank, a live preview of the result, and no obligation to fill anything
// in — an untouched blank stays as it is.
export function TemplateFill({ text, onFilled, onCancel }: Props) {
  const placeholders = useMemo(() => findPlaceholders(text), [text])
  const [values, setValues] = useState<Record<string, string>>({})

  const result = useMemo(() => fillTemplate(text, values), [text, values])
  const remaining = placeholders.filter((p) => !values[p.name]?.trim()).length

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onFilled(result)
      }}
      className="flex flex-col gap-3 rounded-btn border border-line bg-sunk p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {placeholders.map((p, i) => (
          <label key={p.token} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-ink-soft">{p.name}</span>
            <input
              autoFocus={i === 0}
              value={values[p.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
              placeholder={`Your ${p.name}`}
              className="dj-input py-1 text-sm"
            />
          </label>
        ))}
      </div>

      <p className="dj-prompt max-h-32 overflow-auto rounded-btn border border-line bg-surface p-2 text-[13px]">
        {result}
      </p>

      <div className="flex items-center justify-end gap-2">
        <span className="dj-meta mr-auto">
          {remaining === 0
            ? 'All filled in — lovely.'
            : `${remaining} blank${remaining === 1 ? '' : 's'} left — that's fine, they'll stay as they are.`}
        </span>
        <button type="button" onClick={onCancel} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
          Cancel
        </button>
        <button type="submit" className="dj-btn dj-btn-primary px-3 py-1 text-xs">
          Copy
        </button>
      </div>
    </form>
  )
}
