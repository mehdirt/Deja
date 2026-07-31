import { useEffect, useMemo, useRef, useState } from 'react'
import {
  clearAllData,
  purgeDeleted,
  listPrompts,
  bulkUpdateText,
  exportAll,
  importPrompts,
} from '@/lib/db'
import {
  readBlocklist,
  writeBlocklist,
  onBlocklistChange,
  isBlocked,
  type Blocklist,
} from '@/lib/blocklist'
import { readPrefs, writePrefs, onPrefsChange, type ResurfaceClick, type Prefs } from '@/lib/prefs'
import { readHealth, onHealthChange, type CaptureHealth } from '@/lib/health'
import { redactPii, PII_LABEL } from '@/lib/pii'
import { buildMarkdown } from '@/lib/markdown'
import { feedbackHref } from '@/lib/feedback'
import {
  PLATFORM_LABEL,
  PII_KINDS,
  type Platform,
  type FilterStrength,
  type PiiKind,
} from '@/lib/types'

function extVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return ''
  }
}

const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[]

const RESURFACE_OPTIONS: Array<{ key: ResurfaceClick; label: string; hint: string }> = [
  {
    key: 'copy',
    label: 'Copy it',
    hint: 'Clicking a suggestion copies it, so you can paste it yourself.',
  },
  {
    key: 'insert',
    label: 'Type it in for me',
    hint: 'Clicking a suggestion drops it straight into the box at your cursor.',
  },
]

const STRENGTHS: Array<{ key: FilterStrength; label: string; hint: string }> = [
  {
    key: 'off',
    label: 'Save everything',
    hint: 'Keeps every message you send, no exceptions.',
  },
  {
    key: 'balanced',
    label: 'Skip the throwaways',
    hint: 'Skip one-word replies like “yes” or “continue”. Recommended for most people.',
  },
  {
    key: 'strict',
    label: 'Only the good stuff',
    hint: 'Save only longer, detailed questions — short ones are gently skipped.',
  },
]

function siteDot(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  if (!h) return 'bg-ink-faint/40'
  return h.ok ? 'bg-ok' : 'bg-danger'
}

function siteStatus(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  if (!h) return 'Not visited yet'
  return h.ok ? 'Working' : 'Needs attention'
}

function siteTitle(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  const label = PLATFORM_LABEL[p]
  if (!h) return `Deja hasn't seen ${label} yet — open it once and it'll gently start saving`
  return h.ok
    ? `Deja is quietly saving your prompts on ${label}`
    : `Deja can't find the message box on ${label} — the site may have changed`
}

// A small reusable on/off switch matching the library's favorites toggle.
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-full"
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-surface shadow-sm transition-transform ${
            checked ? 'translate-x-[14px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {children}
    </section>
  )
}

// Settings is ordered so the first screen is all plain choices anyone can make.
// The precise, technical controls (pattern rules, per-category redaction, file
// import, permanent erase) are real features people rely on — they're just not
// what a newcomer should meet first, so they live in one collapsed drawer.
export function Settings() {
  const [bl, setBl] = useState<Blocklist>({ domains: [], patterns: [] })
  const [domainInput, setDomainInput] = useState('')
  const [patternInput, setPatternInput] = useState('')
  const [patternError, setPatternError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [purged, setPurged] = useState<number | null>(null)
  const [resurfaceClick, setResurfaceClick] = useState<ResurfaceClick>('copy')
  const [strength, setStrength] = useState<FilterStrength>('balanced')
  const [sites, setSites] = useState<Record<Platform, boolean>>(
    () => Object.fromEntries(PLATFORMS.map((p) => [p, true])) as Record<Platform, boolean>,
  )
  const [health, setHealth] = useState<CaptureHealth>({})
  const [testInput, setTestInput] = useState('')
  const [dryRun, setDryRun] = useState<{
    matched: number
    total: number
    samples: string[]
  } | null>(null)
  const [redactPiiOn, setRedactPiiOn] = useState(true)
  const [piiKinds, setPiiKinds] = useState<Record<PiiKind, boolean>>(
    () => Object.fromEntries(PII_KINDS.map((k) => [k, true])) as Record<PiiKind, boolean>,
  )
  const [piiTest, setPiiTest] = useState('')
  const [piiScan, setPiiScan] = useState<{
    updates: Array<{ id: number; text: string }>
    total: number
  } | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [promptCount, setPromptCount] = useState(0)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void readBlocklist().then(setBl)
    return onBlocklistChange(setBl)
  }, [])

  useEffect(() => {
    void readHealth().then(setHealth)
    return onHealthChange(setHealth)
  }, [])

  useEffect(() => {
    void listPrompts({ includeMinor: true }).then((all) => setPromptCount(all.length))
  }, [cleared, importMsg])

  useEffect(() => {
    const apply = (p: Prefs) => {
      setResurfaceClick(p.resurfaceClick)
      setStrength(p.filterStrength)
      setSites(p.sites)
      setRedactPiiOn(p.redactPii)
      setPiiKinds(p.piiKinds)
    }
    void readPrefs().then(apply)
    return onPrefsChange(apply)
  }, [])

  const setResurface = async (next: ResurfaceClick) => {
    setResurfaceClick(next)
    await writePrefs({ resurfaceClick: next })
  }

  const setFilter = async (next: FilterStrength) => {
    setStrength(next)
    await writePrefs({ filterStrength: next })
  }

  const toggleSite = async (p: Platform) => {
    const next = { ...sites, [p]: !sites[p] }
    setSites(next)
    await writePrefs({ sites: next })
  }

  const setRedact = async (next: boolean) => {
    setRedactPiiOn(next)
    await writePrefs({ redactPii: next })
    setPiiScan(null)
  }

  const togglePiiKind = async (k: PiiKind) => {
    const next = { ...piiKinds, [k]: !piiKinds[k] }
    setPiiKinds(next)
    await writePrefs({ piiKinds: next })
    setPiiScan(null)
  }

  // Live preview of what redaction would do to a sample.
  const piiTestResult = useMemo(
    () => (piiTest.trim() ? redactPii(piiTest, piiKinds) : null),
    [piiTest, piiKinds],
  )

  // Scan already-saved prompts for personal info the current categories would
  // catch, so a library saved before this was on can be cleaned up.
  const runPiiScan = async () => {
    const all = await listPrompts({ includeMinor: true })
    const updates: Array<{ id: number; text: string }> = []
    for (const p of all) {
      if (p.id == null) continue
      const r = redactPii(p.text, piiKinds)
      if (r.total > 0 && r.text !== p.text) updates.push({ id: p.id, text: r.text })
    }
    setPiiScan({ updates, total: all.length })
  }

  const cleanPii = async () => {
    if (!piiScan) return
    await bulkUpdateText(piiScan.updates)
    setPiiScan({ updates: [], total: piiScan.total })
  }

  const persist = async (next: Blocklist) => {
    setBl(next)
    await writeBlocklist(next)
    setDryRun(null) // rules changed — a stale preview would mislead
  }

  const addDomain = async () => {
    const d = domainInput.trim().toLowerCase()
    if (!d || bl.domains.includes(d)) return setDomainInput('')
    await persist({ ...bl, domains: [...bl.domains, d] })
    setDomainInput('')
  }

  const removeDomain = (d: string) => persist({ ...bl, domains: bl.domains.filter((x) => x !== d) })

  const addPattern = async () => {
    const p = patternInput.trim()
    if (!p) return
    // Validate before storing so an obviously-broken pattern is caught here,
    // not silently skipped later. (The matcher also try/catches as a backstop.)
    try {
      new RegExp(p)
    } catch (err) {
      setPatternError(`That isn't a valid pattern: ${String((err as Error).message ?? err)}`)
      return
    }
    setPatternError(null)
    if (bl.patterns.includes(p)) return setPatternInput('')
    await persist({ ...bl, patterns: [...bl.patterns, p] })
    setPatternInput('')
  }

  const removePattern = (p: string) =>
    persist({ ...bl, patterns: bl.patterns.filter((x) => x !== p) })

  // Live test: which rule (if any) would catch the text being typed.
  // null = empty box; '' = no rule matches (would be saved); else the rule.
  const testMatch = useMemo<string | null>(() => {
    const text = testInput.trim()
    if (!text) return null
    for (const src of bl.patterns) {
      if (!src.trim()) continue
      try {
        if (new RegExp(src).test(testInput)) return `the rule /${src}/`
      } catch {
        /* invalid pattern — skip, matches nothing */
      }
    }
    return ''
  }, [testInput, bl.patterns])

  // Dry run: how many ALREADY-saved prompts these rules would catch — so a
  // too-broad rule is visible before you rely on it. Informational only; these
  // rules never delete, they only prevent future saving.
  const runDryRun = async () => {
    const all = await listPrompts({ includeMinor: true })
    const matched = all.filter((p) => isBlocked(p.url, p.text, bl))
    setDryRun({
      matched: matched.length,
      total: all.length,
      samples: matched.slice(0, 3).map((p) => p.text),
    })
  }

  const onClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    await clearAllData()
    setConfirmClear(false)
    setCleared(true)
    window.setTimeout(() => setCleared(false), 4000)
  }

  const onPurgeDeleted = async () => {
    const n = await purgeDeleted()
    setPurged(n)
    window.setTimeout(() => setPurged(null), 5000)
  }

  function download(content: string, type: string, ext: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deja-${new Date().toISOString().slice(0, 10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onExport = async () => {
    const all = await exportAll()
    download(JSON.stringify(all, null, 2), 'application/json', 'json')
  }

  // Markdown export — one readable .md file. buildMarkdown filters out
  // deleted rows and picks a fence longer than any backtick run in the text so
  // multi-line / code prompts survive the round trip.
  const onExportMarkdown = async () => {
    const all = await exportAll()
    download(buildMarkdown(all), 'text/markdown', 'md')
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    setImportMsg(null)
    try {
      const parsed = JSON.parse(await file.text())
      // A Deja backup is a JSON array of prompts. Anything else parses fine but
      // isn't ours — say so plainly instead of reporting "imported 0", which
      // reads like a successful no-op.
      if (!Array.isArray(parsed)) {
        setImportMsg("That file isn't a Deja backup.")
        return
      }
      const res = await importPrompts(parsed)
      setImportMsg(`Added ${res.imported}. Skipped ${res.skipped} you already had.`)
    } catch {
      setImportMsg("Couldn't read that file. It should be a .json backup from Deja.")
    }
  }

  const hasRules = bl.domains.length > 0 || bl.patterns.length > 0
  const version = extVersion()
  const brokenSites = PLATFORMS.filter((p) => health[p]?.ok === false).map((p) => PLATFORM_LABEL[p])
  const captureContext = brokenSites.length
    ? `capture broken on ${brokenSites.join(', ')}`
    : 'capture not working'

  return (
    <div className="flex flex-col gap-9">
      {/* Suggestions — the everyday preference, opens the page */}
      <Section
        title="Suggestions while you type"
        description="When you start typing something you've asked before, Deja quietly offers your earlier version. Choose what happens when you click it."
      >
        <div className="flex flex-wrap gap-2">
          {RESURFACE_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setResurface(o.key)}
              aria-pressed={resurfaceClick === o.key}
              title={o.hint}
              className={`dj-pill ${resurfaceClick === o.key ? 'dj-pill-active' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="dj-meta">{RESURFACE_OPTIONS.find((o) => o.key === resurfaceClick)?.hint}</p>
      </Section>

      {/* What gets saved — selective-capture strength */}
      <Section
        title="What Deja saves"
        description="Not every message is worth keeping. Deja can gently skip short throwaways so your library stays worth browsing — change this anytime."
      >
        <div className="flex flex-wrap gap-2">
          {STRENGTHS.map((o) => (
            <button
              key={o.key}
              onClick={() => setFilter(o.key)}
              aria-pressed={strength === o.key}
              title={o.hint}
              className={`dj-pill ${strength === o.key ? 'dj-pill-active' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="dj-meta">{STRENGTHS.find((o) => o.key === strength)?.hint}</p>
      </Section>

      {/* Where it works — per-site switches folded into the health view */}
      <Section
        title="Where Deja works"
        description="Turn Deja off for any site you'd rather it left alone, no hard feelings. The dot shows whether it can currently find that site's message box."
      >
        <div className="flex flex-col divide-y divide-line rounded-btn border border-line">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="inline-flex items-center gap-2" title={siteTitle(health, p)}>
                <span className={`h-1.5 w-1.5 rounded-full ${siteDot(health, p)}`} aria-hidden />
                <span className={`text-sm ${sites[p] ? 'text-ink' : 'text-ink-faint'}`}>
                  {PLATFORM_LABEL[p]}
                </span>
                <span className="dj-meta">
                  {sites[p] ? siteStatus(health, p) : 'Turned off'}
                </span>
              </span>
              <Switch
                checked={sites[p]}
                onChange={() => toggleSite(p)}
                label={`Save prompts on ${PLATFORM_LABEL[p]}`}
              />
            </div>
          ))}
        </div>
        <p className="dj-meta">
          To take a break everywhere at once, use the pause button in the toolbar popup.
        </p>
        <a
          href={feedbackHref('capture', captureContext, version)}
          target="_blank"
          rel="noopener noreferrer"
          className="dj-meta w-fit underline-offset-2 hover:text-accent hover:underline"
        >
          A site isn&apos;t saving? Let me know →
        </a>
      </Section>

      {/* Personal info — simple on/off up front; the details live in Advanced */}
      <Section
        title="Hide personal info"
        description={
          <>
            Before anything is saved, Deja can swap out personal details — emails, phone numbers,
            card numbers — for placeholders like <span className="font-mono text-xs">[email]</span>.
            The real values are never written down, and the prompt still works as a reusable
            template.
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={redactPiiOn}
            onChange={() => setRedact(!redactPiiOn)}
            label="Hide personal info before saving"
          />
          <span className="text-sm text-ink-soft">{redactPiiOn ? 'On' : 'Off'}</span>
        </div>
      </Section>

      {/* Your prompts — the trust story stays in plain sight */}
      <Section
        title="Your prompts"
        description="Everything lives on this computer and nowhere else. Take a copy whenever you like — you're never locked in."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportMarkdown}
            disabled={promptCount === 0}
            className="dj-btn px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Download as a document
          </button>
          <button
            onClick={onExport}
            disabled={promptCount === 0}
            className="dj-btn px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Download a backup
          </button>
        </div>
        <p className="dj-meta">
          The document is easy to read; the backup is the one to keep if you ever want to bring your
          prompts back.
        </p>

        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={onClearAll}
            onBlur={() => setConfirmClear(false)}
            // aria-live so screen-reader / keyboard users hear the armed state
            // when the label swaps to its destructive confirmation.
            aria-live="polite"
            className={`dj-btn px-3 py-1.5 text-sm ${
              confirmClear ? 'border-danger text-danger' : 'hover:text-danger'
            }`}
          >
            {confirmClear ? 'Sure? This erases everything' : 'Delete everything'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="dj-btn dj-btn-ghost px-2 py-1 text-xs"
            >
              Cancel
            </button>
          )}
          {cleared && <span className="dj-meta">All your prompts were deleted.</span>}
        </div>
      </Section>

      {/* Everything precise and technical, in one drawer */}
      <details className="group rounded-card border border-line bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink marker:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="text-ink-faint transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
            More options
          </span>
          <span className="ml-6 block text-xs font-normal text-ink-faint">
            Fine-grained privacy rules, restoring a backup, and permanent erase.
          </span>
        </summary>

        <div className="flex flex-col gap-9 border-t border-line px-4 py-6">
          {/* Personal-info detail */}
          <Section
            title="Which details to hide"
            description="Only applies while “Hide personal info” is on."
          >
            {redactPiiOn ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {PII_KINDS.map((k) => (
                    <button
                      key={k}
                      onClick={() => togglePiiKind(k)}
                      aria-pressed={piiKinds[k]}
                      title={piiKinds[k] ? `Hiding ${PII_LABEL[k]}` : `Not hiding ${PII_LABEL[k]}`}
                      className={`dj-pill ${piiKinds[k] ? 'dj-pill-active' : ''}`}
                    >
                      {PII_LABEL[k]}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-ink-soft" htmlFor="pii-test">
                    Try it out
                  </label>
                  <input
                    id="pii-test"
                    value={piiTest}
                    onChange={(e) => setPiiTest(e.target.value)}
                    placeholder="Paste something to see what gets hidden"
                    className="dj-input text-sm"
                  />
                  {piiTestResult && (
                    <p className="dj-meta" aria-live="polite">
                      {piiTestResult.total > 0
                        ? piiTestResult.text
                        : 'Nothing personal detected in that.'}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={runPiiScan} className="dj-btn px-3 py-1.5 text-sm">
                    Check prompts I already saved
                  </button>
                  {piiScan && (
                    <span className="dj-meta">
                      {piiScan.updates.length === 0
                        ? `Nothing personal found in your ${piiScan.total} saved prompts.`
                        : `Found personal info in ${piiScan.updates.length} of ${piiScan.total}.`}
                    </span>
                  )}
                </div>
                {piiScan && piiScan.updates.length > 0 && (
                  <button
                    onClick={cleanPii}
                    className="dj-btn w-fit px-3 py-1.5 text-sm hover:text-danger"
                  >
                    Hide them now
                  </button>
                )}
              </>
            ) : (
              <p className="dj-meta">Turn on “Hide personal info” above to choose categories.</p>
            )}
          </Section>

          {/* Blocklist */}
          <Section
            title="Never save from…"
            description="Block a whole site, or add a rule so anything matching it is never saved — handy if you paste secrets into a chat. None of this leaves your machine."
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-ink-soft" htmlFor="bl-domain">
                Blocked sites
              </label>
              <div className="flex gap-2">
                <input
                  id="bl-domain"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  placeholder="claude.ai"
                  className="dj-input text-sm"
                />
                <button onClick={addDomain} className="dj-btn px-3 py-1 text-xs">
                  Block
                </button>
              </div>
              {bl.domains.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bl.domains.map((d) => (
                    <span key={d} className="dj-tag">
                      <span className="dj-tag-label">{d}</span>
                      <button
                        onClick={() => removeDomain(d)}
                        aria-label={`Unblock ${d}`}
                        className="text-ink-faint hover:text-danger"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-ink-soft" htmlFor="bl-pattern">
                Blocked text patterns
                <span className="ml-1 text-ink-faint">
                  (regular expressions — leave alone if unsure)
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  id="bl-pattern"
                  value={patternInput}
                  onChange={(e) => {
                    setPatternInput(e.target.value)
                    setPatternError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && addPattern()}
                  placeholder="sk-[a-zA-Z0-9]{20,}"
                  className="dj-input font-mono text-sm"
                />
                <button onClick={addPattern} className="dj-btn px-3 py-1 text-xs">
                  Add
                </button>
              </div>
              {patternError && <p className="text-xs text-danger">{patternError}</p>}
              {bl.patterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bl.patterns.map((p) => {
                    // Flag any stored pattern that no longer compiles so a user
                    // never assumes a broken rule is protecting them. We don't
                    // remove it automatically — that's their call.
                    let valid = true
                    try {
                      new RegExp(p)
                    } catch {
                      valid = false
                    }
                    return (
                      <span key={p} className="dj-tag font-mono">
                        <span className="dj-tag-label">{p}</span>
                        {!valid && <span className="text-danger">broken</span>}
                        <button
                          onClick={() => removePattern(p)}
                          aria-label={`Remove rule ${p}`}
                          className="text-ink-faint hover:text-danger"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {hasRules && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-ink-soft" htmlFor="bl-test">
                  Check a prompt against your rules
                </label>
                <input
                  id="bl-test"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Paste a prompt to check"
                  className="dj-input text-sm"
                />
                {testMatch !== null && (
                  <p
                    className={`text-xs ${testMatch ? 'text-danger' : 'text-ink-faint'}`}
                    aria-live="polite"
                  >
                    {testMatch
                      ? `This would be blocked by ${testMatch}`
                      : 'This would be saved normally.'}
                  </p>
                )}
              </div>
            )}

            {hasRules && (
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={runDryRun} className="dj-btn px-3 py-1.5 text-sm">
                  See what this would have caught
                </button>
                {dryRun && (
                  <span className="dj-meta">
                    {dryRun.matched === 0
                      ? `None of your ${dryRun.total} saved prompts match.`
                      : `${dryRun.matched} of ${dryRun.total} saved prompts match these rules.`}
                  </span>
                )}
              </div>
            )}
            {dryRun && dryRun.matched > 0 && (
              <div className="flex flex-col gap-1 rounded-btn border border-line bg-sunk px-3 py-2">
                <span className="dj-meta">
                  These stay until you delete them — rules only stop future saving:
                </span>
                {dryRun.samples.map((s, i) => (
                  <span key={i} className="truncate text-xs text-ink-soft">
                    {s.replace(/\s+/g, ' ').trim()}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* Restore a backup */}
          <Section
            title="Restore from a backup"
            description="Bring back a .json backup you downloaded earlier, on this computer or another one. Prompts you already have are skipped."
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={onImportFile}
              className="hidden"
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="dj-btn px-3 py-1.5 text-sm"
              >
                Choose a backup file
              </button>
              {importMsg && <span className="dj-meta">{importMsg}</span>}
            </div>
          </Section>

          {/* Purge deleted */}
          <Section
            title="Erase deleted prompts for good"
            description="Deleting a prompt hides it but keeps the text around so you can undo. If something sensitive was saved, delete it in your library, then erase it here."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onPurgeDeleted}
                className="dj-btn px-3 py-1.5 text-sm hover:text-danger"
              >
                Erase deleted prompts
              </button>
              {purged != null && (
                <span className="dj-meta">
                  {purged === 0
                    ? 'There was nothing to erase.'
                    : `Erased ${purged} deleted prompt${purged === 1 ? '' : 's'}.`}
                </span>
              )}
            </div>
          </Section>
        </div>
      </details>

      {/* Feedback — user-initiated, no telemetry */}
      <Section
        title="Tell me what you think 💬"
        description="Found something confusing, or wish Deja did something it doesn't? I'd love to hear it. Nothing is ever sent automatically — these open a message you read and send yourself."
      >
        <div className="flex flex-wrap gap-2">
          <a
            href={feedbackHref('problem', undefined, version)}
            target="_blank"
            rel="noopener noreferrer"
            className="dj-btn px-3 py-1.5 text-sm"
          >
            Something&apos;s broken 🛠️
          </a>
          <a
            href={feedbackHref('idea', undefined, version)}
            target="_blank"
            rel="noopener noreferrer"
            className="dj-btn dj-btn-ghost px-3 py-1.5 text-sm"
          >
            I have an idea 💡
          </a>
        </div>
        {version && <p className="dj-meta">Deja v{version}</p>}
      </Section>
    </div>
  )
}
