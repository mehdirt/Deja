import { PLATFORM_LABEL, type Platform } from '@/lib/types'

const SITES: Array<{ platform: Platform; host: string }> = [
  { platform: 'chatgpt', host: 'chatgpt.com / chat.openai.com' },
  { platform: 'claude', host: 'claude.ai' },
  { platform: 'gemini', host: 'gemini.google.com' },
  { platform: 'deepseek', host: 'chat.deepseek.com' },
  { platform: 'grok', host: 'grok.com' },
]

// Privacy page — plain and calm. Highest-leverage trust asset; stays specific
// and jargon-free. No marketing fluff.
export function Privacy() {
  return (
    <div className="flex max-w-2xl flex-col gap-7 text-sm leading-relaxed">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Privacy, plainly</h2>
        <p className="text-ink-soft">
          Your prompts stay on this computer. No account, no server, nothing to sign up for.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">What it does</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
          <li>Saves the prompts you send on the sites below, in your browser on this computer.</li>
          <li>
            Saves only what <em>you</em> type — never the AI&apos;s answers.
          </li>
          <li>
            Can swap emails, phones, cards, and keys for placeholders like{' '}
            <span className="font-mono text-xs">[email]</span> before saving (on by default). Real
            values are never written down.
          </li>
          <li>Lets you search, copy, tag, pin, back up, and delete any of it.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">What it never does</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
          <li>Never sends anything over the internet.</li>
          <li>No tracking, analytics, or usage stats — not even anonymous ones.</li>
          <li>No accounts, cloud, or other companies.</li>
          <li>Never reads password, verification-code, or payment boxes.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">It&apos;s yours</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
          <li>Download everything as a document or backup whenever you like.</li>
          <li>Pause Deja, turn off a site, or auto-pause in a private window.</li>
          <li>Tell it never to save from a site, in settings.</li>
          <li>Delete everything permanently in one click.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Where it runs</h3>
        <p className="text-ink-soft">Only on these five sites:</p>
        <ul className="flex flex-col gap-1 text-xs text-ink-soft">
          {SITES.map((s) => (
            <li key={s.platform}>
              {PLATFORM_LABEL[s.platform]} — <span className="font-mono">{s.host}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
