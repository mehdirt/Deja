import { CheckIcon, CloseIcon, LockIcon } from '@/ui/ActionIcons'
import { PLATFORM_COLOR, PLATFORM_LABEL, type Platform } from '@/lib/types'

const SITES: Array<{ platform: Platform; host: string }> = [
  { platform: 'chatgpt', host: 'chatgpt.com / chat.openai.com' },
  { platform: 'claude', host: 'claude.ai' },
  { platform: 'gemini', host: 'gemini.google.com' },
  { platform: 'deepseek', host: 'chat.deepseek.com' },
  { platform: 'grok', host: 'grok.com' },
]

const DOES = [
  'Saves the prompts you send on the sites below, into your browser’s own storage on this computer.',
  'Saves only what you type. The AI’s answers are never recorded.',
  'Swaps personal details it recognises — emails, phone numbers, card numbers, passwords and keys — for placeholders like [email_1] before anything is saved. On by default. Optionally remembers the real values in a private list on this computer for fill-in only — never in a backup. Names, streets, and (if you turn it on) cities/countries use an optional on-device helper in Settings.',
  'Lets you search, copy, tag, favorite, back up, and delete any of it.',
]

const NEVER = [
  'Never sends anything over the internet. Nothing you type leaves this computer.',
  'No tracking, no analytics, no usage statistics — not even anonymous ones.',
  'No accounts, no cloud, no other companies involved.',
  'Never reads password, verification-code, or payment boxes.',
]

const YOURS = [
  'Download everything as a document or a backup file whenever you like.',
  'Pause Deja for a while, switch it off for a site, or let it pause itself in a private window.',
  'Tell it to never save from a particular site, in settings.',
  'Delete everything permanently — after a confirmation in Settings.',
]

function ListCard({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'ok' | 'never' | 'yours'
}) {
  const Icon = tone === 'never' ? CloseIcon : CheckIcon
  const iconClass =
    tone === 'never' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-accent'

  return (
    <section className="dj-panel flex flex-col gap-4">
      <h2 className="dj-section-title">{title}</h2>
      <ul className="flex flex-col gap-3.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-soft">
            <Icon size={14} className={`mt-1 shrink-0 ${iconClass}`} />
            <span>
              {item.includes('[email_1]') ? (
                <>
                  {item.split('[email_1]')[0]}
                  <span className="font-mono text-xs">[email_1]</span>
                  {item.split('[email_1]')[1]}
                </>
              ) : (
                item
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Privacy page — a plain, calm statement of what is and isn't collected.
// This is the highest-leverage trust asset we have, so it stays specific and
// jargon-free. Warm where it costs nothing, but never vague — no marketing.
export function Privacy() {
  return (
    <div className="dj-stagger-auto flex max-w-2xl flex-col gap-5">
      <header className="dj-panel flex flex-col gap-4 !bg-sunk shadow-none">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-surface text-accent shadow-card">
          <LockIcon size={18} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="dj-page-title">Privacy, plainly</h1>
          <p className="dj-page-lead">
            Your prompts stay on your computer and nowhere else — so you can use Deja without
            worrying. It&apos;s a quiet notebook in your browser, not a service. There&apos;s no
            account, no server, and nothing to sign up for.
          </p>
        </div>
      </header>

      <ListCard title="What it does" items={DOES} tone="ok" />
      <ListCard title="What it never does" items={NEVER} tone="never" />
      <ListCard title="It’s yours" items={YOURS} tone="yours" />

      <section className="dj-panel flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="dj-section-title">Where it runs</h2>
          <p className="dj-page-lead">
            Deja is only active on these five sites, and does nothing anywhere else:
          </p>
        </div>
        <ul className="dj-panel-tight flex flex-col divide-y divide-line overflow-hidden">
          {SITES.map((s) => {
            const color = PLATFORM_COLOR[s.platform]
            const light = color.toLowerCase() === '#fff' || color.toLowerCase() === '#ffffff'
            return (
              <li key={s.platform} className="dj-row">
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: color,
                      ...(light ? { boxShadow: 'inset 0 0 0 1px var(--dj-line)' } : {}),
                    }}
                    aria-hidden
                  />
                  {PLATFORM_LABEL[s.platform]}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">{s.host}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
