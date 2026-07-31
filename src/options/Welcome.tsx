import { LogoMark } from '@/ui/Logo'

// Shown once, right after install (the background worker opens the options page
// with ?welcome=1). Deja is a passive tool: the risk isn't that setup is hard,
// it's that nothing visible happens and the extension is forgotten. So this page
// has one job — tell someone what to expect, in the order they'll experience it.

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Ask something, like you always do',
    body: "Open ChatGPT, Claude, Gemini, DeepSeek, or Grok and type your question. Deja doesn't change how any of them work.",
  },
  {
    title: 'It gets saved on its own',
    body: "A small “Saved” note appears in the corner for a moment. Didn't want to keep that one? Click Undo while it's there.",
  },
  {
    title: 'Later, it finds its way back to you',
    body: 'Start typing something you\'ve asked before and your earlier version quietly appears above the box. Click it to reuse it.',
  },
]

export function Welcome({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-10 py-4">
      <header className="flex flex-col items-center gap-4 text-center">
        <LogoMark size={48} />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Deja is on. There&apos;s nothing to set up.
          </h1>
          <p className="mx-auto max-w-lg text-[15px] leading-relaxed text-ink-soft">
            From now on, the questions you ask ChatGPT, Claude, Gemini, DeepSeek, and Grok are kept
            in one place — searchable, reusable, and stored only on this computer.
          </p>
        </div>
      </header>

      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="dj-card flex items-start gap-4 p-4">
            <span
              className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold text-ink">{s.title}</h2>
              <p className="text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Two things worth knowing</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="dj-card flex flex-col gap-1.5 p-4">
            <h3 className="text-sm font-semibold text-ink">Keep Deja within reach</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Click the puzzle-piece icon at the top right of Chrome and pin Deja, so your prompts
              are always one click away. You can also press{' '}
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">
                ⌘⇧K
              </kbd>{' '}
              (or{' '}
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">
                Ctrl+Shift+K
              </kbd>
              ) at any time.
            </p>
          </div>
          <div className="dj-card flex flex-col gap-1.5 p-4">
            <h3 className="text-sm font-semibold text-ink">Nothing leaves this computer</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              No account, no cloud, no tracking — Deja never sends anything anywhere. Personal
              details like emails and phone numbers are swapped for placeholders before a prompt is
              even saved.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line pt-6">
        <a
          href="https://chatgpt.com"
          target="_blank"
          rel="noopener noreferrer"
          className="dj-btn dj-btn-primary px-4 py-2 text-sm"
        >
          Try it on ChatGPT
        </a>
        <button onClick={onDone} className="dj-btn px-4 py-2 text-sm">
          Look around first
        </button>
      </div>
    </div>
  )
}
