// Fill-in-the-blank prompts. A prompt someone actually reuses is rarely reused
// verbatim — it's "write a LinkedIn post about {topic} in a friendly tone",
// where one part changes every time. This module finds those blanks and fills
// them in.
//
// Two kinds of blank, both already present in real libraries:
//   1. Ones people write themselves — {topic}, {{name}}.
//   2. Ones Deja created — the [email] / [phone] placeholders that PII redaction
//      leaves behind. Redaction already turns a prompt into a template; this is
//      what makes that template usable again.
//
// Deliberately NOT a template language: no conditionals, no defaults, no
// escaping rules. A blank is a blank. Anything cleverer is a feature nobody
// asked for and a syntax everyone has to learn.
//
// Pure and dependency-free; the UI layer owns all the state.

import { PII_KINDS } from './types'

// The [labels] PII redaction can leave behind. Only these bracketed words are
// treated as blanks — otherwise ordinary prose like "[sic]" or a Markdown link
// would sprout input boxes.
const PII_PLACEHOLDERS = new Set<string>(PII_KINDS)

// {topic} or {{topic}}: letters, numbers, spaces, dashes and underscores only,
// kept short. This is tight on purpose — JSON, code snippets and CSS all live
// in people's prompts inside braces, and turning those into blanks would be
// worse than having no templates at all.
const BRACE = /\{\{?\s*([a-zA-Z][a-zA-Z0-9 _-]{0,38})\s*\}?\}/g
const BRACKET = /\[([a-z]{2,12})\]/g

export interface Placeholder {
  /** What the UI shows as the field label, e.g. "topic". */
  name: string
  /** Exact text to replace, e.g. "{topic}" or "[email]". */
  token: string
}

/** Every distinct blank in a prompt, in the order it first appears. A blank
 *  repeated in the prompt is one field and fills every occurrence. */
export function findPlaceholders(text: string): Placeholder[] {
  const seen = new Map<string, Placeholder>()

  for (const m of text.matchAll(BRACE)) {
    const name = m[1].trim()
    if (!name) continue
    const key = `{${name.toLowerCase()}}`
    if (!seen.has(key)) seen.set(key, { name, token: m[0] })
  }

  for (const m of text.matchAll(BRACKET)) {
    const name = m[1]
    if (!PII_PLACEHOLDERS.has(name)) continue
    const key = `[${name}]`
    if (!seen.has(key)) seen.set(key, { name, token: m[0] })
  }

  return [...seen.values()]
}

/** True when a prompt has at least one blank worth filling in. */
export function isTemplate(text: string): boolean {
  return findPlaceholders(text).length > 0
}

/** Replace every blank with the value given for it. A blank with no value (or
 *  an all-whitespace one) is left exactly as it was, so a half-filled template
 *  is still a valid prompt rather than a sentence with a hole in it.
 *
 *  Substitution is a single pass: replacing blanks one after another would let
 *  a value that happens to contain "{something}" be treated as a blank by the
 *  next round. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  const filled = new Map<string, string>()
  for (const { name, token } of findPlaceholders(text)) {
    const value = values[name]
    if (value == null || !value.trim()) continue
    filled.set(token, value)
  }
  if (filled.size === 0) return text

  const all = new RegExp(`${BRACE.source}|${BRACKET.source}`, 'g')
  return text.replace(all, (match) => filled.get(match) ?? match)
}
