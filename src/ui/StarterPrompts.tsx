import { useState } from 'react'
import { STARTER_PROMPTS } from '@/lib/starter'
import { TemplateFill } from '@/ui/TemplateFill'

// Shown only while the library is genuinely empty. Copying one is an explicit
// click and nothing is ever written to the library — these are examples on an
// empty page, not content pretending to be the user's own.
export function StarterPrompts() {
  const [open, setOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(i)
      window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 1400)
    } catch {
      /* clipboard blocked — nothing useful to say, and nothing broke */
    }
  }

  return (
    <section className="flex flex-col gap-3 text-left">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Try a starter</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Fill in the blanks, paste into ChatGPT (or anywhere), and it&apos;ll land here after you
          send it.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {STARTER_PROMPTS.map((s, i) => (
          <li key={i} className="dj-card flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="dj-chip w-fit">{s.kind}</span>
                <p className="dj-prompt text-[13px]">{s.text}</p>
              </div>
              <button
                onClick={() => setOpen((o) => (o === i ? null : i))}
                className="dj-btn dj-btn-primary flex-none px-2 py-1 text-xs"
              >
                {copied === i ? 'Copied ✓' : open === i ? 'Close' : 'Try this'}
              </button>
            </div>
            {open === i && (
              <TemplateFill
                text={s.text}
                onFilled={(text) => {
                  setOpen(null)
                  void copy(i, text)
                }}
                onCancel={() => setOpen(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
