import { useCallback, useEffect, useState } from 'react'
import { Logo } from '@/ui/Logo'
import { WelcomeDemo } from '@/ui/WelcomeDemo'
import { readPrefs, writePrefs } from '@/lib/prefs'

// Shown once, right after install (the background worker opens the options page
// with ?welcome=1). Deja is a passive tool: the risk isn't that setup is hard,
// it's that nothing visible happens and the extension is forgotten. So this page
// has one job — make someone feel at home, then tell them what to expect, in
// the order they'll experience it.
//
// Visual language mirrors the landing flow-steps and Library panels: raised
// surface cards, soft accent on the step that needs showing, quiet tips.

const STEPS: Array<{ title: string; body: string; who: string }> = [
  {
    who: 'You',
    title: 'Ask something, like you always do',
    body: 'Open ChatGPT, Claude, Gemini, DeepSeek, or Grok and type your question. Nothing about those sites changes — Deja just listens quietly in the background.',
  },
  {
    who: 'Deja',
    title: 'It gets saved for you',
    body: 'A small “Saved” note pops up in the corner for a moment. Changed your mind? Hit Undo while it’s still there — no fuss.',
  },
  {
    who: 'Together',
    title: 'Later, it finds you again',
    body: 'When you start typing something you’ve asked before, your earlier version gently appears above the box. One click puts that saved version back — change your mind with Undo in the chat box.',
  },
]

export function Welcome({ onDone }: { onDone: () => void }) {
  const [autoPlayDemo, setAutoPlayDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    void readPrefs()
      .then((p) => {
        if (cancelled) return
        setAutoPlayDemo(!p.welcomeDemoSeen)
      })
      .catch(() => {
        /* storage unavailable — the welcome page still reads fine */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const markDemoSeen = useCallback(() => {
    setAutoPlayDemo(false)
    void writePrefs({ welcomeDemoSeen: true })
  }, [])

  return (
    <div className="dj-enter flex flex-col gap-10 py-4">
      <header className="flex flex-col items-center gap-4 text-center">
        <Logo size={48} />
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium text-ink-soft">
            Welcome{' '}
            <span aria-hidden="true" className="inline-block">
              🤗
            </span>
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            You&apos;re all set — make yourself at home.
          </h1>
          <p className="mx-auto max-w-lg text-[15px] leading-relaxed text-ink-soft">
            From now on, the questions you ask ChatGPT, Claude, Gemini, DeepSeek, and Grok are kept
            in one cozy place on this computer. Searchable, reusable, and completely yours. There&apos;s
            nothing to configure — just keep chatting the way you already do.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          Here&apos;s how it feels in practice
        </h2>
        <ol className="dj-stagger-auto flex flex-col gap-3">
          {STEPS.map((s, i) => {
            const featured = i === STEPS.length - 1
            return (
              <li
                key={s.title}
                className="dj-card flex flex-col gap-3.5 p-5 sm:p-[22px]"
                style={
                  featured
                    ? {
                        background:
                          'linear-gradient(180deg, color-mix(in srgb, var(--dj-accent-soft) 70%, var(--dj-surface)), var(--dj-surface) 72%)',
                        borderColor: 'color-mix(in srgb, var(--dj-accent) 22%, var(--dj-line))',
                      }
                    : undefined
                }
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                      featured
                        ? 'bg-accent text-white shadow-cta'
                        : 'border border-line bg-sunk text-ink-soft'
                    }`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-faint">
                      {s.who}
                    </p>
                    <h3 className="text-[17px] font-semibold tracking-tight text-ink sm:text-lg">
                      {s.title}
                    </h3>
                    <p className="text-[14.5px] leading-relaxed text-ink-soft">{s.body}</p>
                  </div>
                </div>
                {featured && (
                  <div className="sm:pl-[46px]">
                    <WelcomeDemo autoPlay={autoPlayDemo} onFirstPlayComplete={markDemoSeen} />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Two gentle tips</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="dj-card flex flex-col gap-1.5 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-ink">
              <span aria-hidden="true">📌 </span>Keep Deja close by
            </h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Click the puzzle-piece icon at the top right of Chrome and pin Deja, so your prompts
              are always one click away.
            </p>
          </div>
          <div className="dj-card flex flex-col gap-1.5 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-ink">
              <span aria-hidden="true">🔒 </span>Your words stay here
            </h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              No account, no cloud, no tracking — nothing leaves this computer. Personal details
              like emails and phone numbers can be hidden before anything is saved, so you can
              relax.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 border-t border-line pt-6">
        <p className="text-center text-sm text-ink-soft">Ready when you are — no rush.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://chatgpt.com"
            target="_blank"
            rel="noopener noreferrer"
            className="dj-btn dj-btn-primary px-4 py-2.5 text-sm"
          >
            Try a question on ChatGPT
          </a>
          <button onClick={onDone} className="dj-btn px-4 py-2.5 text-sm">
            Take a look around first
          </button>
        </div>
      </div>
    </div>
  )
}
