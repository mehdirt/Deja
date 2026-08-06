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
// jargon-free. Warm where it costs nothing, but never vague — no marketing.
export function Privacy() {
  return (
    <div className="flex max-w-2xl flex-col gap-7 text-sm leading-relaxed">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Privacy, plainly</h2>
        <p className="text-ink-soft">
          Your prompts stay on your computer and nowhere else — so you can use Deja without
          worrying. It&apos;s a quiet notebook in your browser, not a service. There&apos;s no
          account, no server, and nothing to sign up for.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">What it does</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
          <li>
            Saves the prompts you send on the sites listed below, into your browser&apos;s own
            storage on this computer.
          </li>
          <li>
            Saves only what <em>you</em> type. The AI&apos;s answers are never recorded.
          </li>
          <li>
            Swaps personal details it recognises — emails, phone numbers, card numbers, passwords
            and keys — for placeholders like <span className="font-mono text-xs">[email]</span>{' '}
            before anything is saved. On by default. The real values are never written down, not
            even in a backup.
          </li>
          <li>Lets you search, copy, tag, favorite, back up, and delete any of it.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">What it never does</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
          <li>Never sends anything over the internet. Nothing you type leaves this computer.</li>
          <li>No tracking, no analytics, no usage statistics — not even anonymous ones.</li>
          <li>No accounts, no cloud, no other companies involved.</li>
          <li>Never reads password, verification-code, or payment boxes.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">It&apos;s yours</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-ink-soft">
          <li>Download everything as a document or a backup file whenever you like.</li>
          <li>
            Pause Deja for a while, switch it off for a site, or let it pause itself in a private
            window.
          </li>
          <li>Tell it to never save from a particular site, in settings.</li>
          <li>Delete everything permanently — after a confirmation in Settings.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Where it runs</h3>
        <p className="text-ink-soft">
          Deja is only active on these five sites, and does nothing anywhere else:
        </p>
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
