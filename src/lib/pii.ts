// PII redaction — strip personal info out of a prompt BEFORE it's stored, so
// Deja's local library (and any JSON export you share) never accumulates a
// plaintext trove of emails, cards, secrets, etc.
//
// APPROACH (and why). We redact, not hash or encrypt:
//   - Hashing low-entropy PII (emails, phones, SSNs) is brute-forceable, so it
//     isn't real protection — and it destroys the prompt's reusability.
//   - Encryption-at-rest adds key management and breaks search/similarity, for
//     little gain given each extension's IndexedDB is already origin-isolated.
//   - Redaction is deterministic, dependency-free, and a rare win-win: the
//     stored prompt becomes a clean, reusable TEMPLATE ("email [email_1] about …")
//     while the raw value never touches the prompt table.
//
// Detection is high-precision regex + checksums (Presidio-style recognizers),
// tuned to UNDER-detect rather than mangle good prompts. Same raw value in one
// prompt (or already in the optional local vault) reuses the same numbered
// placeholder. Names and street addresses need on-device NER — still deferred.
// Pure + unit-tested; runs in the background worker at capture time.

import type { PiiKind } from './types'
import { PII_KINDS } from './types'

export const PII_LABEL: Record<PiiKind, string> = {
  secret: 'API keys & tokens',
  email: 'email addresses',
  card: 'credit-card numbers',
  iban: 'IBANs',
  ssn: 'social-security numbers',
  phone: 'phone numbers',
  ip: 'IP addresses',
}

const ALL_ON: Record<PiiKind, boolean> = {
  secret: true,
  email: true,
  card: true,
  iban: true,
  ssn: true,
  phone: true,
  ip: true,
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g
const IPV4_RE =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const IPV6_RE = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g
const PHONE_RE =
  /(?<!\d)(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g

// Kept specific (gitleaks-style) to avoid false positives on ordinary prose.
const SECRET_RES: RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, // Anthropic
  /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g, // OpenAI project key
  /\bsk-[A-Za-z0-9]{20,}\b/g, // OpenAI-style
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe secret
  /\brk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe restricted
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g, // GitLab PAT
  /\bnpm_[A-Za-z0-9]{36}\b/g, // npm access token
  /\bshpat_[A-Za-z0-9]{32,}\b/g, // Shopify
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
]

export function luhnValid(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

/** US SSN structural rules — reject reserved areas / zero group or serial. */
export function ssnValid(ssn: string): boolean {
  const m = /^(\d{3})-(\d{2})-(\d{4})$/.exec(ssn)
  if (!m) return false
  const area = Number(m[1])
  const group = Number(m[2])
  const serial = Number(m[3])
  if (area === 0 || area === 666 || area >= 900) return false
  if (group === 0 || serial === 0) return false
  return true
}

/** ISO 13616 IBAN check (mod 97 == 1). */
export function ibanValid(iban: string): boolean {
  const compact = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false
  if (compact.length < 15 || compact.length > 34) return false
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  let expanded = ''
  for (const c of rearranged) {
    const code = c.charCodeAt(0)
    expanded += code >= 65 && code <= 90 ? String(code - 55) : c
  }
  let rest = 0
  for (const ch of expanded) {
    rest = (rest * 10 + (ch.charCodeAt(0) - 48)) % 97
  }
  return rest === 1
}

export interface RedactResult {
  text: string
  counts: Record<PiiKind, number>
  total: number
  /** Placeholder token → original value for this pass (e.g. "[email_1]" → "a@b.com"). */
  mappings: Record<string, string>
}

interface Hit {
  start: number
  end: number
  kind: PiiKind
  value: string
}

function emptyCounts(): Record<PiiKind, number> {
  return {
    secret: 0,
    email: 0,
    card: 0,
    iban: 0,
    ssn: 0,
    phone: 0,
    ip: 0,
  }
}

function rangeFree(claimed: boolean[], start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (claimed[i]) return false
  return true
}

function claimRange(claimed: boolean[], start: number, end: number): void {
  for (let i = start; i < end; i++) claimed[i] = true
}

function pushRegexHits(
  text: string,
  claimed: boolean[],
  hits: Hit[],
  kind: PiiKind,
  patterns: RegExp[],
  validate?: (value: string) => boolean,
): void {
  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const value = m[0]
      if (validate && !validate(value)) continue
      const start = m.index
      const end = start + value.length
      if (!rangeFree(claimed, start, end)) continue
      claimRange(claimed, start, end)
      hits.push({ start, end, kind, value })
    }
  }
}

function collectHits(text: string, enabled: Record<PiiKind, boolean>): Hit[] {
  const claimed = new Array<boolean>(text.length).fill(false)
  const hits: Hit[] = []

  // Order: greedier / more specific first so a card isn't half-eaten as a phone.
  if (enabled.secret) pushRegexHits(text, claimed, hits, 'secret', SECRET_RES)
  if (enabled.email) pushRegexHits(text, claimed, hits, 'email', [EMAIL_RE])
  if (enabled.card) {
    pushRegexHits(text, claimed, hits, 'card', [CARD_RE], (value) => {
      const digits = value.replace(/\D/g, '')
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits)
    })
  }
  if (enabled.iban) pushRegexHits(text, claimed, hits, 'iban', [IBAN_RE], ibanValid)
  if (enabled.ssn) pushRegexHits(text, claimed, hits, 'ssn', [SSN_RE], ssnValid)
  if (enabled.ip) pushRegexHits(text, claimed, hits, 'ip', [IPV4_RE, IPV6_RE])
  if (enabled.phone) pushRegexHits(text, claimed, hits, 'phone', [PHONE_RE])

  hits.sort((a, b) => a.start - b.start)
  return hits
}

/** Next free index for a kind given tokens already in use ("[email_3]" → 3). */
export function nextIndexForKind(kind: PiiKind, usedTokens: Iterable<string>): number {
  const re = new RegExp(`^\\[${kind}_(\\d+)\\]$`)
  let max = 0
  for (const token of usedTokens) {
    const m = re.exec(token)
    if (m) max = Math.max(max, Number(m[1]))
    // Legacy un-numbered "[email]" counts as slot 1 if nothing else claimed it.
    if (token === `[${kind}]`) max = Math.max(max, 1)
  }
  return max + 1
}

function tokenFor(kind: PiiKind, index: number): string {
  return `[${kind}_${index}]`
}

/**
 * Assign stable numbered placeholders. Same raw value → same token within this
 * pass; values already in `existingVault` reuse their token.
 */
export function assignPlaceholders(
  hits: Array<{ kind: PiiKind; value: string }>,
  existingVault: Record<string, string> = {},
): { tokens: string[]; mappings: Record<string, string> } {
  const valueToToken = new Map<string, string>()
  for (const [token, value] of Object.entries(existingVault)) {
    if (!valueToToken.has(value)) valueToToken.set(value, token)
  }
  const usedTokens = new Set<string>(Object.keys(existingVault))
  const nextIndex: Partial<Record<PiiKind, number>> = {}
  const mappings: Record<string, string> = {}
  const tokens: string[] = []

  for (const hit of hits) {
    const prior = valueToToken.get(hit.value)
    if (prior) {
      tokens.push(prior)
      mappings[prior] = hit.value
      continue
    }
    const idx = nextIndex[hit.kind] ?? nextIndexForKind(hit.kind, usedTokens)
    const token = tokenFor(hit.kind, idx)
    nextIndex[hit.kind] = idx + 1
    usedTokens.add(token)
    valueToToken.set(hit.value, token)
    mappings[token] = hit.value
    tokens.push(token)
  }
  return { tokens, mappings }
}

export interface RedactOptions {
  /** Existing vault map (token → value) so numbers stay stable across prompts. */
  existingVault?: Record<string, string>
}

/**
 * Redact enabled PII categories from `input`. Order of detection matters for
 * overlapping spans; numbering is stable for repeated values. Pure; never throws.
 */
export function redactPii(
  input: string,
  enabled: Record<PiiKind, boolean> = ALL_ON,
  options: RedactOptions = {},
): RedactResult {
  const counts = emptyCounts()
  if (!input) return { text: input, counts, total: 0, mappings: {} }

  const hits = collectHits(input, enabled)
  if (hits.length === 0) return { text: input, counts, total: 0, mappings: {} }

  const { tokens, mappings } = assignPlaceholders(hits, options.existingVault)
  for (const hit of hits) counts[hit.kind]++

  let out = ''
  let cursor = 0
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]
    out += input.slice(cursor, hit.start)
    out += tokens[i]
    cursor = hit.end
  }
  out += input.slice(cursor)

  const total = PII_KINDS.reduce((n, k) => n + counts[k], 0)
  return { text: out, counts, total, mappings }
}

/** Convenience: does this text contain any (enabled) PII? */
export function hasPii(input: string, enabled?: Record<PiiKind, boolean>): boolean {
  return redactPii(input, enabled).total > 0
}
