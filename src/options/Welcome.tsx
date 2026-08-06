import { Logo } from '@/ui/Logo'

// Shown once, right after install (the background worker opens the options page
// with ?welcome=1). Deja is a passive tool: the risk isn't that setup is hard,
// it's that nothing visible happens and the extension is forgotten. So this page
// has one job — make someone feel at home, then tell them what to expect, in
// the order they'll experience it. Warm and simple on purpose: everyday users
// shouldn't feel like they're configuring software.

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Ask something, like you always do',
    body: "Open ChatGPT, Claude, Gemini, DeepSeek, or Grok and type your question. Nothing about those sites changes — Deja just listens quietly in the background.",
  },
  {
    title: 'It gets saved for you',
    body: 'A small “Saved” note pops up in the corner for a moment. Changed your mind? Hit Undo while it’s still there — no fuss.',
  },
  {
    title: 'Later, it finds you again',
    body: "When you start typing something you’ve asked before, your earlier version gently appears above the box. One click replaces what you were typing with that saved version — change your mind with Undo in the chat box.",
  },
]

export function Welcome({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col gap-10 py-4">
      <header className="flex flex-col items-center gap-4 text-center">
        <Logo size={48} />
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium text-ink-soft">
            Welcome{' '}
            <span aria-hidden="true" className="inline-block">
              🤗
            </span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            You&apos;re all set — make yourself at home.
          </h1>
          <p className="mx-auto max-w-lg text-[15px] leading-relaxed text-ink-soft">
            From now on, the questions you ask ChatGPT, Claude, Gemini, DeepSeek, and Grok are kept
            in one cozy place on this computer. Searchable, reusable, and completely yours. There&apos;s
            nothing to configure — just keep chatting the way you already do.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-ink">Here&apos;s how it feels in practice</p>
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
        <h2 className="text-base font-semibold text-ink">Two gentle tips</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="dj-card flex flex-col gap-1.5 p-4">
            <h3 className="text-sm font-semibold text-ink">
              <span aria-hidden="true">📌 </span>Keep Deja close by
            </h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Click the puzzle-piece icon at the top right of Chrome and pin Deja, so your prompts
              are always one click away.
            </p>
          </div>
          <div className="dj-card flex flex-col gap-1.5 p-4">
            <h3 className="text-sm font-semibold text-ink">
              <span aria-hidden="true">🔒 </span>Your words stay here
            </h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              No account, no cloud, no tracking — nothing leaves this computer. Personal details
              like emails and phone numbers can be swapped for placeholders before anything is
              saved, so you can relax.
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
            className="dj-btn dj-btn-primary px-4 py-2 text-sm"
          >
            Try a question on ChatGPT
          </a>
          <button onClick={onDone} className="dj-btn px-4 py-2 text-sm">
            Take a look around first
          </button>
        </div>
      </div>
    </div>
  )
}
