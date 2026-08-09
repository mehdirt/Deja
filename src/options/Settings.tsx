import { useEffect, useMemo, useRef, useState } from 'react'
import {
  clearAllData,
  listPrompts,
  bulkUpdateText,
  exportAll,
  purgeExpiredDeleted,
} from '@/lib/db'
import {
  readBlocklist,
  writeBlocklist,
  onBlocklistChange,
  isBlocked,
  type Blocklist,
} from '@/lib/blocklist'
import { readPrefs, writePrefs, onPrefsChange, type ResurfaceClick, type Prefs } from '@/lib/prefs'
import {
  LIBRARY_CAP_CHOICES,
  LIBRARY_CAP_DEFAULT,
  trimLibraryToCap,
} from '@/lib/libraryCap'
import { readHealth, onHealthChange, type CaptureHealth } from '@/lib/health'
import { PII_LABEL } from '@/lib/pii'
import { clearPiiVault, mergePiiVault, readPiiVault } from '@/lib/piiVault'
import { NER_SIZE_HINT } from '@/lib/nerPii'
import {
  DEFAULT_NER_STATUS,
  onNerStatusChange,
  readNerStatus,
  writeNerStatus,
  type NerStatus,
} from '@/lib/nerStatus'
import { buildMarkdown } from '@/lib/markdown'
import { restoreBackupFromText } from '@/lib/restoreBackup'
import { feedbackHref } from '@/lib/feedback'
import { BugIcon, ChevronIcon, IdeaIcon, CheckCircleIcon, CrossCircleIcon } from '@/ui/ActionIcons'
import {
  PLATFORM_LABEL,
  PII_KINDS,
  PII_NER_KINDS,
  PII_STRUCTURED_KINDS,
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
    hint: 'Clicking a suggestion clears the box and types the remembered prompt in.',
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
  if (!h) return 'bg-ink-faint'
  return h.ok ? 'bg-ok' : 'bg-danger'
}

function siteStatus(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  if (!h) return 'Not yet'
  return h.ok ? 'Saving' : 'Needs attention'
}

function siteTitle(health: CaptureHealth, p: Platform): string {
  const h = health[p]
  const label = PLATFORM_LABEL[p]
  if (!h) return `Deja hasn't seen ${label} yet — open it once and it'll gently start saving`
  return h.ok
    ? `Deja is quietly saving your prompts on ${label}`
    : `Deja can't find the message box on ${label} — the site may have changed, so prompts there might not be saved.`
}

function siteStatusClass(health: CaptureHealth, p: Platform, enabled: boolean): string {
  if (!enabled) return 'dj-meta-chip'
  const h = health[p]
  if (h && !h.ok) return 'dj-meta-chip text-danger'
  if (!h) return 'dj-meta-chip text-ink-faint'
  return 'dj-meta-chip'
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
      className="inline-flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-surface shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

/** Progress ring — fills with real download progress. */
function NerProgressRing({ progress }: { progress: number }) {
  const size = 16
  const stroke = 1.75
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, progress))
  // Soft spin only before the first byte report; then determinate fill.
  const awaiting = clamped < 0.005
  const fill = awaiting ? 0.22 : clamped
  const offset = c * (1 - fill)
  const mid = size / 2
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={awaiting ? 'dj-spin' : undefined}
      aria-hidden="true"
    >
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-line"
      />
      {/* Rotate via <g> — CSS transform on SVG circle is unreliable in Chromium. */}
      <g transform={`rotate(-90 ${mid} ${mid})`}>
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          className="text-accent"
        />
      </g>
    </svg>
  )
}

/** Title-aligned glyph: progress · check · cross. */
function NerStatusGlyph({ active, status }: { active: boolean; status: NerStatus }) {
  if (!active) return null
  if (status.state === 'ready') {
    return (
      <span className="inline-flex shrink-0 text-accent" title="Ready" aria-label="Helper ready">
        <CheckCircleIcon size={16} />
      </span>
    )
  }
  if (status.state === 'error') {
    return (
      <span
        className="inline-flex shrink-0 text-danger"
        title="Couldn’t finish"
        aria-label="Download failed"
      >
        <CrossCircleIcon size={16} />
      </span>
    )
  }
  const pct = Math.round(Math.min(1, Math.max(0, status.progress)) * 100)
  const hasPct = status.progress > 0.005
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-accent"
      title={hasPct ? `Downloading… ${pct}%` : 'Getting ready…'}
      aria-label={hasPct ? `Downloading, ${pct} percent` : 'Getting the helper ready'}
      role="status"
    >
      <NerProgressRing progress={status.progress} />
      {hasPct && (
        <span className="text-[11px] font-medium tabular-nums leading-none tracking-tight">
          {pct}%
        </span>
      )}
    </span>
  )
}

/** Error follow-up under the helper description — busy state is the ring only. */
function NerStatusFollowUp({
  active,
  status,
  onRetry,
}: {
  active: boolean
  status: NerStatus
  onRetry: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  if (!active) return null
  if (status.state !== 'error') return null

  return (
    <div className="mt-2 flex flex-col gap-1.5" aria-live="polite">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-danger">
          {status.error ?? 'Couldn\u2019t finish downloading.'}
        </p>
        <button type="button" onClick={onRetry} className="dj-btn dj-btn-ghost px-2 py-1 text-xs">
          Try again
        </button>
        {status.errorDetail ? (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="dj-meta underline-offset-2 hover:text-ink hover:underline"
          >
            {showDetails ? 'Hide details' : 'What went wrong?'}
          </button>
        ) : null}
      </div>
      {showDetails && status.errorDetail ? (
        <p className="rounded-btn bg-sunk px-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
          {status.errorDetail}
        </p>
      ) : null}
    </div>
  )
}

function Section({
  title,
  description,
  children,
  bare,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  /** Skip the raised panel — used inside the More options drawer. */
  bare?: boolean
}) {
  return (
    <section className={bare ? 'flex flex-col gap-3' : 'dj-panel flex flex-col gap-4'}>
      <div className="flex flex-col gap-1">
        <h2 className="dj-section-title">{title}</h2>
        {description && <p className="dj-page-lead">{description}</p>}
      </div>
      {children}
    </section>
  )
}

// Settings is ordered so the first screen is all plain choices anyone can make.
// The precise, technical controls (pattern rules, per-category redaction, file
// import, permanent erase) are real features people rely on — they're just not
// what a newcomer should meet first, so they live in one collapsed drawer.
export function Settings({ onShowWelcome }: { onShowWelcome: () => void }) {
  const [bl, setBl] = useState<Blocklist>({ domains: [], patterns: [] })
  const [domainInput, setDomainInput] = useState('')
  const [patternInput, setPatternInput] = useState('')
  const [patternError, setPatternError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [resurfaceClick, setResurfaceClick] = useState<ResurfaceClick>('insert')
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
  const [rememberHidden, setRememberHidden] = useState(true)
  const [nerNamesPlaces, setNerNamesPlaces] = useState(false)
  const [nerStatus, setNerStatus] = useState<NerStatus>(DEFAULT_NER_STATUS)
  const [piiKinds, setPiiKinds] = useState<Record<PiiKind, boolean>>(() => {
    const out = Object.fromEntries(PII_KINDS.map((k) => [k, false])) as Record<PiiKind, boolean>
    for (const k of PII_STRUCTURED_KINDS) out[k] = true
    return out
  })
  const [piiTest, setPiiTest] = useState('')
  const [piiTestResult, setPiiTestResult] = useState<{ text: string; total: number } | null>(null)
  const [vaultCount, setVaultCount] = useState(0)
  const [piiScan, setPiiScan] = useState<{
    updates: Array<{ id: number; text: string }>
    total: number
    mappings: Record<string, string>
  } | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importOk, setImportOk] = useState(false)
  const [promptCount, setPromptCount] = useState(0)
  const [libraryCap, setLibraryCap] = useState(LIBRARY_CAP_DEFAULT)

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
    void purgeExpiredDeleted()
  }, [])

  useEffect(() => {
    const apply = (p: Prefs) => {
      setResurfaceClick(p.resurfaceClick)
      setStrength(p.filterStrength)
      setSites(p.sites)
      setRedactPiiOn(p.redactPii)
      setRememberHidden(p.rememberHiddenDetails)
      setNerNamesPlaces(p.nerNamesPlaces)
      setPiiKinds(p.piiKinds)
      setLibraryCap(p.libraryCap)
    }
    void readPrefs().then(apply)
    return onPrefsChange(apply)
  }, [])

  useEffect(() => {
    void readNerStatus().then(setNerStatus)
    return onNerStatusChange(setNerStatus)
  }, [])

  useEffect(() => {
    void readPiiVault().then((v) => setVaultCount(Object.keys(v).length))
  }, [cleared, piiScan])

  // Live “Try it out” via background so NER is included when ready.
  useEffect(() => {
    const sample = piiTest.trim()
    if (!sample) {
      setPiiTestResult(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      void chrome.runtime
        .sendMessage({ type: 'REDACT_PREVIEW', text: sample })
        .then((resp: { ok?: boolean; text?: string; total?: number } | undefined) => {
          if (cancelled || !resp?.ok || typeof resp.text !== 'string') return
          setPiiTestResult({ text: resp.text, total: resp.total ?? 0 })
        })
        .catch(() => {
          if (!cancelled) setPiiTestResult(null)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [piiTest, piiKinds, redactPiiOn, nerNamesPlaces, nerStatus.state])

  const setResurface = async (next: ResurfaceClick) => {
    setResurfaceClick(next)
    await writePrefs({ resurfaceClick: next })
  }

  const setFilter = async (next: FilterStrength) => {
    setStrength(next)
    await writePrefs({ filterStrength: next })
  }

  const setCap = async (next: number) => {
    setLibraryCap(next)
    await writePrefs({ libraryCap: next })
    // Applying a tighter limit should trim right away, not wait for the next save.
    if (next > 0) {
      const n = await trimLibraryToCap(next)
      if (n > 0) {
        void listPrompts({ includeMinor: true }).then((all) => setPromptCount(all.length))
      }
    }
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

  const setRemember = async (next: boolean) => {
    setRememberHidden(next)
    await writePrefs({ rememberHiddenDetails: next })
  }

  const forgetRemembered = async () => {
    await clearPiiVault()
    setVaultCount(0)
  }

  const setNer = async (next: boolean) => {
    setNerNamesPlaces(next)
    if (next) {
      // Names + streets on with the helper; cities stay off until the extra toggle.
      const kinds = { ...piiKinds, person: true, place: true }
      setPiiKinds(kinds)
      // Optimistic busy state so the ring appears the moment the switch flips.
      // Don't write progress:0 here — that races the offscreen tracker and
      // freezes the ring. loadModel owns the reset.
      setNerStatus((s) =>
        s.state === 'ready'
          ? s
          : {
              ...s,
              state: 'downloading',
              progress: s.progress || 0,
              error: undefined,
              errorDetail: undefined,
            },
      )
      await writePrefs({ nerNamesPlaces: true, piiKinds: kinds })
      void chrome.runtime.sendMessage({ type: 'NER_LOAD' }).catch(() => {})
    } else {
      await writePrefs({ nerNamesPlaces: false })
    }
    setPiiScan(null)
  }

  const setNerCities = async (next: boolean) => {
    const kinds = { ...piiKinds, city: next }
    setPiiKinds(kinds)
    await writePrefs({ piiKinds: kinds })
    setPiiScan(null)
  }

  const retryNerDownload = () => {
    setNerStatus((s) => ({
      ...s,
      state: 'downloading',
      progress: 0,
      error: undefined,
      errorDetail: undefined,
    }))
    void writeNerStatus(
      {
        state: 'downloading',
        progress: 0,
        error: undefined,
        errorDetail: undefined,
      },
      { resetProgress: true },
    )
    void chrome.runtime.sendMessage({ type: 'NER_LOAD' }).catch(() => {})
  }

  const togglePiiKind = async (k: PiiKind) => {
    const next = { ...piiKinds, [k]: !piiKinds[k] }
    setPiiKinds(next)
    await writePrefs({ piiKinds: next })
    setPiiScan(null)
  }

  // Scan already-saved prompts for personal info the current categories would
  // catch, so a library saved before this was on can be cleaned up.
  const runPiiScan = async () => {
    const all = await listPrompts({ includeMinor: true })
    const vault = rememberHidden ? await readPiiVault() : {}
    const updates: Array<{ id: number; text: string }> = []
    const mappings: Record<string, string> = {}
    let existing = { ...vault }
    for (const p of all) {
      if (p.id == null) continue
      try {
        const resp = (await chrome.runtime.sendMessage({
          type: 'REDACT_PREVIEW',
          text: p.text,
          existingVault: existing,
        })) as
          | { ok?: boolean; text?: string; total?: number; mappings?: Record<string, string> }
          | undefined
        if (!resp?.ok || typeof resp.text !== 'string') continue
        if ((resp.total ?? 0) > 0 && resp.text !== p.text) {
          updates.push({ id: p.id, text: resp.text })
          if (resp.mappings) {
            Object.assign(mappings, resp.mappings)
            existing = { ...existing, ...resp.mappings }
          }
        }
      } catch {
        /* skip one row — never fail the whole scan */
      }
    }
    setPiiScan({ updates, total: all.length, mappings })
  }

  const cleanPii = async () => {
    if (!piiScan) return
    await bulkUpdateText(piiScan.updates)
    if (rememberHidden && Object.keys(piiScan.mappings).length > 0) {
      const next = await mergePiiVault(piiScan.mappings)
      setVaultCount(Object.keys(next).length)
    }
    setPiiScan({ updates: [], total: piiScan.total, mappings: {} })
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
    setImportOk(false)
    const result = await restoreBackupFromText(await file.text(), libraryCap)
    setImportOk(result.ok)
    setImportMsg(result.message)
  }

  const hasRules = bl.domains.length > 0 || bl.patterns.length > 0
  const version = extVersion()
  const brokenSites = PLATFORMS.filter((p) => health[p]?.ok === false).map((p) => PLATFORM_LABEL[p])
  const captureContext = brokenSites.length
    ? `capture broken on ${brokenSites.join(', ')}`
    : 'capture not working'

  return (
    <div className="dj-stagger-auto flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="dj-page-title">Settings</h1>
          <p className="dj-page-lead mt-1">Everyday choices first — extras stay tucked away.</p>
        </div>
        <button
          onClick={onShowWelcome}
          className="dj-btn dj-btn-ghost px-2.5 py-1.5 text-xs"
        >
          Show me how this works again
        </button>
      </header>

      {/* Suggestions — the everyday preference, opens the page */}
      <Section
        title="Suggestions while you type"
        description="When you start typing something you've asked before, Deja quietly offers your earlier version. Choose what happens when you click it."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {RESURFACE_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setResurface(o.key)}
              aria-pressed={resurfaceClick === o.key}
              className={`dj-choice ${resurfaceClick === o.key ? 'dj-choice-active' : ''}`}
            >
              <span className="dj-choice-label text-sm font-medium text-ink">{o.label}</span>
              <span className="text-[12px] leading-snug text-ink-soft">{o.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* What gets saved — selective-capture strength */}
      <Section
        title="What Deja saves"
        description="Not every message is worth keeping. Deja can gently skip short throwaways so your library stays worth browsing — change this anytime."
      >
        <div className="grid gap-2">
          {STRENGTHS.map((o) => (
            <button
              key={o.key}
              onClick={() => setFilter(o.key)}
              aria-pressed={strength === o.key}
              className={`dj-choice dj-choice-tier-${o.key} ${strength === o.key ? 'dj-choice-active' : ''}`}
            >
              <span className="dj-choice-label text-sm font-medium text-ink">{o.label}</span>
              <span className="text-[12px] leading-snug text-ink-soft">{o.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Where it works — per-site switches + capture-health (sole home for this) */}
      <Section
        title="Where Deja works"
        description="Turn Deja off for any site you'd rather it left alone, no hard feelings. The colored dot shows whether it can find that site's message box right now."
      >
        {brokenSites.length > 0 && (
          <p className="rounded-btn border border-danger bg-sunk px-3 py-2 text-sm text-danger">
            Deja may not be saving on {brokenSites.join(', ')} right now — the site may have
            changed. Use the link below if you want to tell us.
          </p>
        )}
        <div className="dj-panel-tight flex flex-col divide-y divide-line overflow-hidden">
          {PLATFORMS.map((p) => {
            const title = siteTitle(health, p)
            return (
              <div key={p} className="dj-row">
                <span
                  className="inline-flex min-w-0 flex-wrap items-center gap-2"
                  title={title}
                  aria-label={title}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      sites[p] && health[p]?.ok === false ? 'dj-glow-danger' : siteDot(health, p)
                    }`}
                    aria-hidden
                  />
                  <span className={`text-sm font-medium ${sites[p] ? 'text-ink' : 'text-ink-faint'}`}>
                    {PLATFORM_LABEL[p]}
                  </span>
                  <span className={siteStatusClass(health, p, sites[p])}>
                    {sites[p] ? siteStatus(health, p) : 'Turned off'}
                  </span>
                </span>
                <Switch
                  checked={sites[p]}
                  onChange={() => toggleSite(p)}
                  label={`Save prompts on ${PLATFORM_LABEL[p]}`}
                />
              </div>
            )
          })}
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
            card numbers, keys — for placeholders like{' '}
            <span className="font-mono text-xs">[email_1]</span>. The prompt stays reusable. Names
            and street addresses need an optional helper you can turn on below.
          </>
        }
      >
        <div className="dj-panel-tight flex flex-col divide-y divide-line overflow-hidden">
          <div className="dj-row">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Hide before saving</p>
              <p className="dj-meta mt-0.5">
                {redactPiiOn ? 'On — details become placeholders' : 'Off'}
              </p>
            </div>
            <Switch
              checked={redactPiiOn}
              onChange={() => setRedact(!redactPiiOn)}
              label="Hide personal info before saving"
            />
          </div>
          {redactPiiOn && (
            <div className="dj-row">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Remember for fill-in</p>
                <p className="dj-meta mt-0.5">
                  Keep the real details in a private list on this computer so you can put them back
                  when you reuse a prompt. Never included in a backup.
                  {vaultCount > 0 ? ` (${vaultCount} remembered)` : ''}
                </p>
              </div>
              <Switch
                checked={rememberHidden}
                onChange={() => setRemember(!rememberHidden)}
                label="Remember hidden details for fill-in"
              />
            </div>
          )}
          {redactPiiOn && (
            <div className="dj-row items-start">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="text-sm font-medium text-ink">Also hide names &amp; street addresses</p>
                  <NerStatusGlyph active={nerNamesPlaces} status={nerStatus} />
                </div>
                <p className="dj-meta mt-0.5">
                  Downloads a small helper ({NER_SIZE_HINT}) that runs only on this computer. Your
                  prompts never leave the device.
                </p>
                <NerStatusFollowUp
                  active={nerNamesPlaces}
                  status={nerStatus}
                  onRetry={retryNerDownload}
                />
              </div>
              <Switch
                checked={nerNamesPlaces}
                onChange={() => setNer(!nerNamesPlaces)}
                label="Also hide names and street addresses"
              />
            </div>
          )}
          {redactPiiOn && nerNamesPlaces && (
            <div className="dj-row">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Also hide cities &amp; countries</p>
                <p className="dj-meta mt-0.5">
                  Uses the same helper. Try it on trip plans — if it hides too much, turn it off.
                </p>
              </div>
              <Switch
                checked={piiKinds.city === true}
                onChange={() => setNerCities(!piiKinds.city)}
                label="Also hide cities and countries"
              />
            </div>
          )}
        </div>
        {redactPiiOn && rememberHidden && vaultCount > 0 && (
          <button
            type="button"
            onClick={forgetRemembered}
            className="dj-btn dj-btn-ghost w-fit px-2.5 py-1.5 text-xs"
          >
            Forget remembered details
          </button>
        )}
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

        <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            onClick={onClearAll}
            onBlur={() => setConfirmClear(false)}
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
      <details className="dj-filter group">
        <summary className="dj-filter-summary">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">More options</span>
            <span className="dj-meta mt-0.5 block">
              Exactly which details to hide, a prompt limit, and restoring a backup.
            </span>
          </span>
          <ChevronIcon
            size={14}
            className="shrink-0 text-ink-faint transition-transform group-open:rotate-180"
          />
        </summary>

        <div className="dj-filter-body gap-5">
          {/* Personal-info detail */}
          <Section
            bare
            title="Which details to hide"
            description="Only applies while “Hide personal info” is on."
          >
            {redactPiiOn ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {(nerNamesPlaces ? PII_KINDS : PII_STRUCTURED_KINDS).map((k) => (
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
                {nerNamesPlaces && nerStatus.state !== 'ready' && (
                  <p className="dj-meta">
                    Names and street addresses turn on after the helper finishes downloading.
                    {PII_NER_KINDS.every((k) => !piiKinds[k])
                      ? ''
                      : ' Structured details (email, phone, …) still hide as usual.'}
                  </p>
                )}

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
            bare
            title="Never save from…"
            description="Skip a whole site, or add a rule so anything matching it is never saved — handy if you paste secrets into a chat. None of this leaves your machine."
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-ink-soft" htmlFor="bl-domain">
                Sites to skip
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  id="bl-domain"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  placeholder="claude.ai"
                  className="dj-input min-w-0 flex-1 text-sm"
                />
                <button onClick={addDomain} className="dj-btn w-fit shrink-0 px-3 py-1 text-xs">
                  Never save
                </button>
              </div>
              {bl.domains.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bl.domains.map((d) => (
                    <span key={d} className="dj-tag">
                      <span className="dj-tag-label">{d}</span>
                      <button
                        onClick={() => removeDomain(d)}
                        aria-label={`Stop skipping ${d}`}
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
                Text patterns to skip
                <span className="ml-1 text-ink-faint">
                  (regular expressions — leave alone if unsure)
                </span>
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input
                  id="bl-pattern"
                  value={patternInput}
                  onChange={(e) => {
                    setPatternInput(e.target.value)
                    setPatternError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && addPattern()}
                  placeholder="sk-[a-zA-Z0-9]{20,}"
                  className="dj-input min-w-0 flex-1 font-mono text-sm"
                />
                <button onClick={addPattern} className="dj-btn w-fit shrink-0 px-3 py-1 text-xs">
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

          {/* Optional size ceiling — off by default */}
          <Section
            bare
            title="Keep at most…"
            description="Ceiling on how many prompts stay saved. Past that number, Deja permanently removes the ones you use least (oldest first when tied). Favorites stay. Default is 5,000 — high enough that most people never notice."
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Maximum prompts to keep">
              {LIBRARY_CAP_CHOICES.map((n) => {
                const on = libraryCap === n
                const label = n === 0 ? 'No limit' : n.toLocaleString()
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => void setCap(n)}
                    className={`dj-pill ${on ? 'dj-pill-active' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="dj-meta">
              {promptCount.toLocaleString()} saved now
              {libraryCap > 0 ? ` · ceiling ${libraryCap.toLocaleString()}` : ' · no ceiling'}.
            </p>
          </Section>

          {/* Restore a backup */}
          <Section
            bare
            title="Restore from a backup"
            description="Bring back a backup you downloaded earlier, on this computer or another one. Prompts you already have are skipped."
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
              {importMsg && (
                <span
                  className={`dj-meta inline-flex min-w-0 items-center gap-1.5 ${
                    importOk ? 'text-ok' : ''
                  }`}
                  role="status"
                >
                  {importOk && (
                    <CheckCircleIcon size={14} className="shrink-0 text-ok" />
                  )}
                  <span className="min-w-0">{importMsg}</span>
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
            <BugIcon size={14} />
            Something&apos;s broken
          </a>
          <a
            href={feedbackHref('idea', undefined, version)}
            target="_blank"
            rel="noopener noreferrer"
            className="dj-btn dj-btn-ghost px-3 py-1.5 text-sm"
          >
            <IdeaIcon size={14} />
            I have an idea
          </a>
        </div>
        {version && <p className="dj-meta">Deja v{version}</p>}
      </Section>
    </div>
  )
}
