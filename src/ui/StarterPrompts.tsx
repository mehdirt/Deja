import { useEffect, useState } from 'react'
import { startersFor } from '@/lib/starter'
import { onPrefsChange, readPrefs } from '@/lib/prefs'
import { TemplateFill } from '@/ui/TemplateFill'

// Shown only while the library is genuinely empty. Copying one is an explicit
// click and nothing is ever written to the library — these are examples on an
// empty page, not content pretending to be the user's own.
export function StarterPrompts() {
  const [open, setOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  // Narrowed to whatever the person picked on the welcome screen; an empty
  // pick (including skipping it) shows all of them.
  const [intents, setIntents] = useState<readonly string[]>([])

  useEffect(() => {
    let cancelled = false
    void readPrefs()
      .then((p) => {
        if (!cancelled) setIntents(p.intents)
      })
      .catch(() => {
        /* storage unavailable — showing every starter is the safe fallback */
      })
    const unsub = onPrefsChange((p) => setIntents(p.intents))
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const starters = startersFor(intents)

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
        <h2 className="text-base font-semibold text-ink">
          Not sure what to ask? That&apos;s okay{' '}
          <span aria-hidden="true">💡</span>
        </h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          Here are a few friendly starters to borrow. Fill in the blanks, paste one into ChatGPT
          (or wherever you like), and it&apos;ll be waiting here afterwards — no pressure.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {starters.map((s, i) => (
          <li key={i} className="dj-card flex min-w-0 flex-col gap-2 p-3">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="dj-chip w-fit">{s.kind}</span>
                <p className="dj-prompt text-[13px]">{s.text}</p>
              </div>
              <button
                onClick={() => setOpen((o) => (o === i ? null : i))}
                className="dj-btn dj-btn-primary w-fit flex-none px-2 py-1 text-xs"
              >
                {copied === i ? 'Copied ✓' : open === i ? 'Close' : 'Use this'}
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
