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
//     stored prompt becomes a clean, reusable TEMPLATE ("email [email] about …")
//     while the raw value never touches disk.
//
// Detection is high-precision regex (the Presidio-style recognizer approach),
// tuned to UNDER-detect rather than mangle good prompts (e.g. a Luhn check gates
// card numbers). Names and street addresses need on-device NER — deferred to a
// later version; this covers structured PII only. Pure + unit-tested; runs in
// the background worker at capture time, off the content hot path.

import type { PiiKind } from './types'
import { PII_KINDS } from './types'

export const PII_LABEL: Record<PiiKind, string> = {
  secret: 'api keys & tokens',
  email: 'email addresses',
  card: 'credit-card numbers',
  iban: 'ibans',
  ssn: 'social-security numbers',
  phone: 'phone numbers',
  ip: 'ip addresses',
}

// Labeled placeholders — unambiguous and template-friendly.
const PLACEHOLDER: Record<PiiKind, string> = {
  secret: '[secret]',
  email: '[email]',
  card: '[card]',
  iban: '[iban]',
  ssn: '[ssn]',
  phone: '[phone]',
  ip: '[ip]',
}

const ALL_ON: Record<PiiKind, boolean> = {
  secret: true, email: true, card: true, iban: true, ssn: true, phone: true, ip: true,
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const IPV6_RE = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g
// IBAN: 2-letter country + 2 check digits + 11–30 alphanumerics (grouping optional).
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g
// A card CANDIDATE: 13–19 digits with optional spaces/dashes between them.
// Starts and ends on a digit so a trailing separator isn't swallowed. Luhn-
// checked below.
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g
// US/intl-ish phone: optional country code, 3-3-4, common separators. Digit
// boundaries stop it eating a longer number.
const PHONE_RE = /(?<!\d)(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g
// Common secret/token shapes (kept specific to avoid false positives).
const SECRET_RES: RegExp[] = [
  /\bsk-[A-Za-z0-9]{20,}\b/g, // OpenAI-style
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
]

function luhnValid(digits: string): boolean {
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

export interface RedactResult {
  text: string
  counts: Record<PiiKind, number>
  total: number
}

/**
 * Redact enabled PII categories from `input`, returning the safe text and how
 * many of each kind were replaced. Order matters: greedier / more specific
 * patterns (secrets, cards) run before looser ones (phone) so a card's digits
 * aren't half-eaten by the phone matcher. Pure; never throws.
 */
export function redactPii(input: string, enabled: Record<PiiKind, boolean> = ALL_ON): RedactResult {
  let text = input
  const counts: Record<PiiKind, number> = {
    secret: 0, email: 0, card: 0, iban: 0, ssn: 0, phone: 0, ip: 0,
  }

  if (enabled.secret) {
    for (const re of SECRET_RES) {
      text = text.replace(re, () => {
        counts.secret++
        return PLACEHOLDER.secret
      })
    }
  }
  if (enabled.email) {
    text = text.replace(EMAIL_RE, () => {
      counts.email++
      return PLACEHOLDER.email
    })
  }
  if (enabled.card) {
    text = text.replace(CARD_RE, (m) => {
      const digits = m.replace(/\D/g, '')
      if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
        counts.card++
        return PLACEHOLDER.card
      }
      return m
    })
  }
  if (enabled.iban) {
    text = text.replace(IBAN_RE, () => {
      counts.iban++
      return PLACEHOLDER.iban
    })
  }
  if (enabled.ssn) {
    text = text.replace(SSN_RE, () => {
      counts.ssn++
      return PLACEHOLDER.ssn
    })
  }
  if (enabled.ip) {
    text = text.replace(IPV4_RE, () => {
      counts.ip++
      return PLACEHOLDER.ip
    })
    text = text.replace(IPV6_RE, () => {
      counts.ip++
      return PLACEHOLDER.ip
    })
  }
  if (enabled.phone) {
    text = text.replace(PHONE_RE, () => {
      counts.phone++
      return PLACEHOLDER.phone
    })
  }

  const total = PII_KINDS.reduce((n, k) => n + counts[k], 0)
  return { text, counts, total }
}

/** Convenience: does this text contain any (enabled) PII? */
export function hasPii(input: string, enabled?: Record<PiiKind, boolean>): boolean {
  return redactPii(input, enabled).total > 0
}
