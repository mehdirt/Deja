import { LogoMark } from '@/ui/Logo'

// Shown once after install (?welcome=1). One job: feel at home, then say what
// to expect — warm and short. Everyday users shouldn't feel like they're
// configuring software.

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Ask like you always do',
    body: 'Use ChatGPT, Claude, Gemini, DeepSeek, or Grok as usual. Deja listens in the background.',
  },
  {
    title: 'It gets saved',
    body: 'A small “Saved” note appears briefly. Changed your mind? Hit Undo while it’s there.',
  },
  {
    title: 'It finds you again',
    body: 'Start typing something you’ve asked before and your earlier version appears. One click to reuse it.',
  },
]

export function Welcome({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-10 py-4">
      <header className="flex flex-col items-center gap-4 text-center">
        <LogoMark size={48} />
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium text-ink-soft">
            Welcome{' '}
            <span aria-hidden="true" className="inline-block">
              🤗
            </span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            You&apos;re all set.
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-ink-soft">
            Your questions to ChatGPT, Claude, Gemini, DeepSeek, and Grok are kept on this computer —
            searchable and yours. Nothing to configure; just keep chatting.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">How it works</p>
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
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Two tips</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="dj-card flex flex-col gap-1.5 p-4">
            <h3 className="text-sm font-semibold text-ink">Pin Deja</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Click Chrome&apos;s puzzle icon and pin Deja — or press{' '}
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">
                ⌘⇧K
              </kbd>{' '}
              /{' '}
              <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">
                Ctrl+Shift+K
              </kbd>
              .
            </p>
          </div>
          <div className="dj-card flex flex-col gap-1.5 p-4">
            <h3 className="text-sm font-semibold text-ink">Stays on this computer</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              No account, no cloud, no tracking. Emails and phone numbers can become placeholders
              before anything is saved.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-center gap-3 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://chatgpt.com"
            target="_blank"
            rel="noopener noreferrer"
            className="dj-btn dj-btn-primary px-4 py-2 text-sm"
          >
            Try ChatGPT
          </a>
          <button onClick={onDone} className="dj-btn px-4 py-2 text-sm">
            Browse the library
          </button>
        </div>
      </div>
    </div>
  )
}
