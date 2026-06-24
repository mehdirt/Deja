import { useEffect, useState } from 'react'
import { clearAllData } from '@/lib/db'
import {
  readBlocklist,
  writeBlocklist,
  onBlocklistChange,
  type Blocklist,
} from '@/lib/blocklist'
import { CaptureStatus } from '@/ui/CaptureStatus'

// Settings — data controls + the capture blocklist + a capture-health view.
// Calm and lowercase, on-voice. Destructive actions ask twice.
export function Settings() {
  const [bl, setBl] = useState<Blocklist>({ domains: [], patterns: [] })
  const [domainInput, setDomainInput] = useState('')
  const [patternInput, setPatternInput] = useState('')
  const [patternError, setPatternError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    void readBlocklist().then(setBl)
    return onBlocklistChange(setBl)
  }, [])

  const persist = async (next: Blocklist) => {
    setBl(next)
    await writeBlocklist(next)
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
      setPatternError(`invalid regex: ${String((err as Error).message ?? err)}`)
      return
    }
    setPatternError(null)
    if (bl.patterns.includes(p)) return setPatternInput('')
    await persist({ ...bl, patterns: [...bl.patterns, p] })
    setPatternInput('')
  }

  const removePattern = (p: string) =>
    persist({ ...bl, patterns: bl.patterns.filter((x) => x !== p) })

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

  return (
    <div className="flex flex-col gap-8">
      {/* Capture health, surfaced alongside the data controls */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">capture health</h2>
        <p className="text-sm text-ink-soft">
          a quiet check that the shelf is still listening on each site. green means we can find the
          prompt box; red means the site changed and capture may be paused there.
        </p>
        <CaptureStatus />
      </section>

      {/* Blocklist */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-mono text-sm text-ink">capture blocklist</h2>
          <p className="text-sm text-ink-soft">
            opt-in protection on top of capture-everything. block a site so nothing is captured
            there, or add a regex so prompts that look like secrets (passwords, keys) are never
            stored. nothing here leaves your machine.
          </p>
        </div>

        {/* domains */}
        <div className="flex flex-col gap-2">
          <label className="font-mono text-xs text-ink-soft" htmlFor="bl-domain">
            blocked sites
          </label>
          <div className="flex gap-2">
            <input
              id="bl-domain"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              placeholder="e.g. claude.ai"
              className="ps-input font-mono text-sm"
            />
            <button onClick={addDomain} className="ps-btn px-3 py-1 text-xs">
              block
            </button>
          </div>
          {bl.domains.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bl.domains.map((d) => (
                <span key={d} className="ps-tag">
                  <span className="ps-tag-label">{d}</span>
                  <button
                    onClick={() => removeDomain(d)}
                    aria-label={`unblock ${d}`}
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
            blocked patterns (regex)
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
              className="ps-input font-mono text-sm"
            />
            <button onClick={addPattern} className="ps-btn px-3 py-1 text-xs">
              add
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
                  <span key={p} className="ps-tag">
                    <span className="ps-tag-label">{p}</span>
                    {!valid && <span className="text-danger">invalid</span>}
                    <button
                      onClick={() => removePattern(p)}
                      aria-label={`remove pattern ${p}`}
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
      </section>

      {/* Clear all data */}
      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-sm text-ink">clear all data</h2>
        <p className="text-sm text-ink-soft">
          permanently erase every captured prompt from this machine. this can&apos;t be undone —
          export first if you might want them back.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onClearAll}
            onBlur={() => setConfirmClear(false)}
            // aria-live so screen-reader / keyboard users hear the armed state
            // when the label swaps to its destructive confirmation.
            aria-live="polite"
            className={`ps-btn px-3 py-1.5 text-sm ${
              confirmClear ? 'border-danger text-danger' : 'hover:text-danger'
            }`}
          >
            {confirmClear ? 'are you sure? click to erase' : 'clear all'}
          </button>
          {confirmClear && (
            <button
              onClick={() => setConfirmClear(false)}
              className="ps-btn ps-btn-ghost px-2 py-1 text-xs"
            >
              cancel
            </button>
          )}
          {cleared && <span className="font-mono text-xs text-ink-faint">all prompts cleared.</span>}
        </div>
      </section>
    </div>
  )
}
