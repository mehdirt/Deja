import { PLATFORM_LABEL, type Platform } from '@/lib/types'

const SITES: Array<{ platform: Platform; host: string }> = [
  { platform: 'chatgpt', host: 'chatgpt.com / chat.openai.com' },
  { platform: 'claude', host: 'claude.ai' },
  { platform: 'gemini', host: 'gemini.google.com' },
  { platform: 'deepseek', host: 'chat.deepseek.com' },
  { platform: 'grok', host: 'grok.com' },
]

// Privacy page — a plain, calm statement of what is and isn't collected.
// This is the highest-leverage trust asset we have, so it stays specific and
// on-voice. No marketing.
export function Privacy() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 text-sm leading-relaxed">
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">Privacy, plainly</h2>
        <p className="text-ink-soft">
          Deja keeps your prompts on your machine and nowhere else. It is a local notebook,
          not a service. There is no account, no server, and nothing to sign up for.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">What it does</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>
            Saves the prompts you send on the supported sites below, to a local database
            (IndexedDB) in your browser.
          </li>
          <li>Captures only the prompt text you type. It does not record the AI&apos;s replies.</li>
          <li>Lets you search, copy, tag, pin, export, import, and delete those prompts.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">What it never does</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>No network calls. Nothing you type ever leaves your machine.</li>
          <li>No telemetry, analytics, or tracking — not even anonymous usage stats.</li>
          <li>No accounts, no cloud, no third-party services.</li>
          <li>No reading or storing of the model&apos;s responses.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">It&apos;s your data</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>Export everything to JSON or Markdown anytime, and import it back.</li>
          <li>
            Pause capture anytime, switch off any site, or auto-pause in incognito — record
            only what you want.
          </li>
          <li>
            Block a site or a regex pattern in settings so sensitive prompts are never stored.
          </li>
          <li>Clear all data in settings to erase the whole library permanently.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">Sites it reads from</h3>
        <p className="text-ink-soft">
          The extension only runs on these sites — you can audit the full list in the manifest:
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-ink-soft">
          {SITES.map((s) => (
            <li key={s.platform}>
              {PLATFORM_LABEL[s.platform]} — {s.host}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
