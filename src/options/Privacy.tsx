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
// lowercase, on-voice. No marketing.
export function Privacy() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 text-sm leading-relaxed">
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">privacy, plainly</h2>
        <p className="text-ink-soft">
          promptshelf keeps your prompts on your machine and nowhere else. it is a local notebook,
          not a service. there is no account, no server, and nothing to sign up for.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">what it does</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>
            saves the prompts you send on the supported sites below, to a local database
            (indexeddb) in your browser.
          </li>
          <li>captures only the prompt text you type. it does not record the ai&apos;s replies.</li>
          <li>lets you search, copy, tag, pin, export, import, and delete those prompts.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">what it never does</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>no network calls. nothing you type ever leaves your machine.</li>
          <li>no telemetry, analytics, or tracking — not even anonymous usage stats.</li>
          <li>no accounts, no cloud, no third-party services.</li>
          <li>no reading or storing of the model&apos;s responses.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">it&apos;s your data</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">
          <li>export everything to json or markdown anytime, and import it back.</li>
          <li>
            block a site or a regex pattern in settings so sensitive prompts are never stored.
          </li>
          <li>clear all data in settings to erase the whole library permanently.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-mono text-xs text-ink-soft">sites it reads from</h3>
        <p className="text-ink-soft">
          the extension only runs on these sites — you can audit the full list in the manifest:
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
