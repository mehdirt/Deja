import { useEffect, useMemo, useState } from 'react'
import { clearAllData, purgeDeleted, listPrompts } from '@/lib/db'
import {
  readBlocklist,
  writeBlocklist,
  onBlocklistChange,
  isBlocked,
  type Blocklist,
} from '@/lib/blocklist'
import { readPrefs, writePrefs, onPrefsChange, type ResurfaceClick } from '@/lib/prefs'
import { readHealth, onHealthChange, type CaptureHealth } from '@/lib/health'
import { PLATFORM_LABEL, type Platform, type FilterStrength } from '@/lib/types'

const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[]

const RESURFACE_OPTIONS: Array<{ key: ResurfaceClick; label: string; hint: string }> = [
  { key: 'copy', label: 'Copy to clipboard', hint: 'Click a match to copy it — paste it yourself' },
  { key: 'insert', label: 'Insert at cursor', hint: 'Click a match to drop it into the box at your cursor' },
]

const STRENGTHS: Array<{ key: FilterStrength; label: string; hint: string }> = [
  { key: 'off', label: 'Keep everything', hint: 'Save and show every prompt — no filtering' },
  { key: 'balanced', label: 'Balanced', hint: 'Hide obvious throwaways like “yes” or “continue” (default)' },
  { key: 'strict', label: 'Strict', hint: 'Keep only longer, structured, substantial prompts' },
]

function siteDot(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  if (!h) return 'bg-ink-faint/40'
  return h.ok ? 'bg-ok' : 'bg-danger'
}

function siteTitle(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  const label = PLATFORM_LABEL[p]
  if (!h) return `Not checked yet — open ${label} and Deja starts listening`
  return h.ok
    ? `Capture is working on ${label}`
    : `Couldn't find the prompt box on ${label} — the site may have changed`
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

// Settings — ordered light-first: the everyday suggestion/filter preferences
// open the page; the heavier capture management sits in the middle; the
// destructive data controls come last. Calm, sentence-cased, on-voice.
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
  const [dryRun, setDryRun] = useState<{ matched: number; total: number; samples: string[] } | null>(
    null,
  )

  useEffect(() => {
    void readBlocklist().then(setBl)
    return onBlocklistChange(setBl)
  }, [])

  useEffect(() => {
    void readHealth().then(setHealth)
    return onHealthChange(setHealth)
  }, [])

  useEffect(() => {
    const apply = (p: { resurfaceClick: ResurfaceClick; filterStrength: FilterStrength; sites: Record<Platform, boolean> }) => {
      setResurfaceClick(p.resurfaceClick)
      setStrength(p.filterStrength)
      setSites(p.sites)
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
    // Validate before storing so an obviously-broken regex is caught here,
    // not silently skipped later. (The matcher also try/catches as a backstop.)
    try {
      new RegExp(p)
    } catch (err) {
      setPatternError(`Invalid regex: ${String((err as Error).message ?? err)}`)
      return
    }
    setPatternError(null)
    if (bl.patterns.includes(p)) return setPatternInput('')
    await persist({ ...bl, patterns: [...bl.patterns, p] })
    setPatternInput('')
  }

  const removePattern = (p: string) =>
    persist({ ...bl, patterns: bl.patterns.filter((x) => x !== p) })

  // Live test: which rule (if any) would catch the text the user is typing.
  // null = empty box; '' = no rule matches (would be captured); else the
  // matching pattern source.
  const testMatch = useMemo<string | null>(() => {
    const text = testInput.trim()
    if (!text) return null
    for (const src of bl.patterns) {
      if (!src.trim()) continue
      try {
        if (new RegExp(src).test(testInput)) return `pattern /${src}/`
      } catch {
        /* invalid pattern — skip, matches nothing */
      }
    }
    return ''
  }, [testInput, bl.patterns])

  // Dry run: how many ALREADY-saved prompts these rules would catch — so a
  // too-broad rule is visible before you rely on it. Informational only; the
  // blocklist never deletes, it only prevents future capture.
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

  const hasRules = bl.domains.length > 0 || bl.patterns.length > 0

  return (
    <div className="flex flex-col gap-8">
      {/* Resurface behavior — the everyday preference, opens the page */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">When you click a resurfaced match</h2>
        <p className="text-sm text-ink-soft">
          Deja can suggest a similar prompt you saved before as you type. Choose what a click does.
        </p>
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
        <p className="font-mono text-xs text-ink-faint">
          {RESURFACE_OPTIONS.find((o) => o.key === resurfaceClick)?.hint}
        </p>
      </section>

      {/* Keep but hide — selective-capture strength */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">Filter short &amp; throwaway prompts</h2>
        <p className="text-sm text-ink-soft">
          Deja always saves everything, but it can keep short throwaways out of your library and the
          “you’ve been here before” suggestions so neither gets cluttered. Nothing is lost — filtered
          prompts sit under <span className="font-mono text-xs">Filtered (n)</span> in the library,
          where you can <span className="font-mono text-xs">Keep</span> any of them.
        </p>
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
        <p className="font-mono text-xs text-ink-faint">
          {STRENGTHS.find((o) => o.key === strength)?.hint}
        </p>
      </section>

      {/* Capture — per-site switches folded into the health view */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-sm text-ink">Capture</h2>
          <p className="text-sm text-ink-soft">
            Deja captures on these sites. The dot shows whether it can currently find the prompt box
            (green) or the site may have changed (red). Switch a site off to stop capturing there.
          </p>
        </div>
        <div className="flex flex-col divide-y divide-line rounded-btn border border-line">
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="inline-flex items-center gap-2" title={siteTitle(health, p)}>
                <span className={`h-1.5 w-1.5 rounded-full ${siteDot(health, p)}`} aria-hidden />
                <span className={`text-sm ${sites[p] ? 'text-ink' : 'text-ink-faint'}`}>
                  {PLATFORM_LABEL[p]}
                </span>
                {!sites[p] && <span className="font-mono text-[10px] text-ink-faint">Off</span>}
              </span>
              <Switch
                checked={sites[p]}
                onChange={() => toggleSite(p)}
                label={`Capture on ${PLATFORM_LABEL[p]}`}
              />
            </div>
          ))}
        </div>
        <p className="font-mono text-xs text-ink-faint">
          Tip: use the ⏸ pause in the toolbar popup to stop capture everywhere for a while.
        </p>
      </section>

      {/* Don't capture — blocklist */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-sm text-ink">Capture blocklist</h2>
          <p className="text-sm text-ink-soft">
            Opt-in protection on top of capture-everything. Block a site so nothing is captured
            there, or add a regex so prompts that look like secrets (passwords, keys) are never
            stored. Nothing here leaves your machine.
          </p>
        </div>

        {/* domains */}
        <div className="flex flex-col gap-2">
          <label className="font-mono text-xs text-ink-soft" htmlFor="bl-domain">
            Blocked sites
          </label>
          <div className="flex gap-2">
            <input
              id="bl-domain"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              placeholder="e.g. claude.ai"
              className="dj-input font-mono text-sm"
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

        {/* patterns */}
        <div className="flex flex-col gap-2">
          <label className="font-mono text-xs text-ink-soft" htmlFor="bl-pattern">
            Blocked patterns (regex)
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
              placeholder="e.g. sk-[a-zA-Z0-9]{20,}"
              className="dj-input font-mono text-sm"
            />
            <button onClick={addPattern} className="dj-btn px-3 py-1 text-xs">
              Add
            </button>
          </div>
          {patternError && <p className="font-mono text-xs text-danger">{patternError}</p>}
          {bl.patterns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bl.patterns.map((p) => {
                // Flag any stored pattern that no longer compiles so a user
                // never assumes a broken regex is protecting them. We don't
                // remove it automatically — that's their call.
                let valid = true
                try {
                  new RegExp(p)
                } catch {
                  valid = false
                }
                return (
                  <span key={p} className="dj-tag">
                    <span className="dj-tag-label">{p}</span>
                    {!valid && <span className="text-danger">Invalid</span>}
                    <button
                      onClick={() => removePattern(p)}
                      aria-label={`Remove pattern ${p}`}
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

        {/* test box — see what a rule would do before trusting it */}
        {hasRules && (
          <div className="flex flex-col gap-2">
            <label className="font-mono text-xs text-ink-soft" htmlFor="bl-test">
              Test a prompt against your rules
            </label>
            <input
              id="bl-test"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Paste a prompt to check…"
              className="dj-input font-mono text-sm"
            />
            {testMatch !== null && (
              <p
                className={`font-mono text-xs ${testMatch ? 'text-danger' : 'text-ink-faint'}`}
                aria-live="polite"
              >
                {testMatch ? `Would be blocked · matches ${testMatch}` : 'Would be captured ✓'}
              </p>
            )}
          </div>
        )}

        {/* dry run — impact on prompts you already have */}
        {hasRules && (
          <div className="flex items-center gap-3">
            <button onClick={runDryRun} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
              Preview impact on saved prompts
            </button>
            {dryRun && (
              <span className="font-mono text-xs text-ink-faint">
                {dryRun.matched === 0
                  ? `None of your ${dryRun.total} saved prompts match.`
                  : `${dryRun.matched} of ${dryRun.total} saved prompts match these rules.`}
              </span>
            )}
          </div>
        )}
        {dryRun && dryRun.matched > 0 && (
          <div className="flex flex-col gap-1 rounded-btn border border-line bg-sunk px-3 py-2">
            <span className="font-mono text-[10px] text-ink-faint">
              Examples (these stay until you delete them — the blocklist only stops future capture):
            </span>
            {dryRun.samples.map((s, i) => (
              <span key={i} className="truncate font-mono text-xs text-ink-soft">
                {s.replace(/\s+/g, ' ').trim()}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Purge deleted — true erase of soft-deleted rows */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">Purge deleted prompts</h2>
        <p className="text-sm text-ink-soft">
          Deleting a prompt hides it but keeps the text on disk so you can undo. If something
          sensitive was captured (a password, a key), delete it in the library, then purge here to
          erase it for good.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onPurgeDeleted} className="dj-btn px-3 py-1.5 text-sm hover:text-danger">
            Purge deleted now
          </button>
          {purged != null && (
            <span className="font-mono text-xs text-ink-faint">
              {purged === 0 ? 'Nothing to purge.' : `Purged ${purged} deleted prompt${purged === 1 ? '' : 's'}.`}
            </span>
          )}
        </div>
      </section>

      {/* Clear all data */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">Clear all data</h2>
        <p className="text-sm text-ink-soft">
          Permanently erase every captured prompt from this machine. This can&apos;t be undone —
          export first if you might want them back.
        </p>
        <div className="flex items-center gap-3">
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
            {confirmClear ? 'Are you sure? Click to erase' : 'Clear all'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="dj-btn dj-btn-ghost px-2 py-1 text-xs"
            >
              Cancel
            </button>
          )}
          {cleared && <span className="font-mono text-xs text-ink-faint">All prompts cleared.</span>}
        </div>
      </section>
    </div>
  )
}
