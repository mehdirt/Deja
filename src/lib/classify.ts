// Selective capture — decide whether a captured prompt is worth keeping in the
// library, or is a throwaway "minor" prompt (a one-word follow-up, a bare
// "yes"/"continue", a tiny fragment) that would only clutter the library and
// add noise to the resurface tooltip.
//
// PHILOSOPHY
//   - Never blocks capture, never deletes. A minor prompt is still STORED (soft
//     capture, fully recoverable) — just flagged so the library and resurface
//     hide it by default. The user can show/keep it any time, or turn the whole
//     filter off in settings. Nothing is ever silently lost.
//   - The bar is deliberately CONSERVATIVE. We'd rather keep a borderline prompt
//     than hide one the user wanted. Only obvious throwaways are flagged.
//   - "Hard to remember & reusable" is the real target, but reusability is not
//     detectable locally without a model (v1 ships zero LLM calls). So we proxy
//     it with what we CAN measure: triviality, length, and structural substance.
//   - Local, pure, zero-dependency, unit-testable. The constants are PROVISIONAL
//     and centralized here so tuning is a one-line change once we have real data.

import type { FilterStrength } from './types'

// At/under this many characters a prompt is "short" and must show some substance
// (see hasSubstance) — or carry at least the words threshold — to be kept. The
// 'strict' strength raises both bars so only longer / structured prompts survive.
const SHORT_CHARS: Record<Exclude<FilterStrength, 'off'>, number> = { balanced: 35, strict: 80 }
const RICH_WORDS: Record<Exclude<FilterStrength, 'off'>, number> = { balanced: 6, strict: 12 }

// Exact throwaway prompts: conversational glue that is never worth reusing.
// Matched against the WHOLE normalized text (sans trailing punctuation), never
// as a substring — so a bare "explain" is flagged while "explain the CAP
// theorem" is untouched. Lowercase; keep this list tight and obvious.
const TRIVIAL = new Set([
  'yes',
  'no',
  'y',
  'n',
  'ok',
  'okay',
  'k',
  'kk',
  'sure',
  'yep',
  'yup',
  'nope',
  'yeah',
  'nah',
  'thanks',
  'thank you',
  'thank you!',
  'ty',
  'thx',
  'cheers',
  'great',
  'nice',
  'perfect',
  'cool',
  'continue',
  'go on',
  'go ahead',
  'keep going',
  'proceed',
  'next',
  'more',
  'go',
  'do it',
  'please',
  'please do',
  'ok do it',
  'now',
  'and',
  'so',
  'again',
  'redo',
  'retry',
  'rerun',
  'fix it',
  'fix this',
  'undo',
  'why',
  'how',
  'what',
  'huh',
  'really',
  'wait',
  'explain',
  'elaborate',
  'expand',
  'clarify',
  'summarize',
  'summarise',
  'tldr',
  'rewrite',
  'shorten',
  'simplify',
  'translate',
  'hmm',
  'idk',
  'hi',
  'hello',
  'hey',
  'yo',
  'test',
  'testing',
])

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

// Signals that even a short prompt carries reusable substance and should be
// kept: code, links, file paths, or structure (lists, multiple sentences).
// Any one of these rescues a short prompt from being flagged minor. Reads the
// RAW text so newline-based structure survives.
function hasSubstance(text: string): boolean {
  if (/```|`[^`]+`/.test(text)) return true // code fence or inline code
  if (/https?:\/\/|www\./i.test(text)) return true // a URL
  // A filename / path with a known code-ish extension.
  if (
    /[\w-]+\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|rb|sh|json|ya?ml|md|css|html|sql|toml)\b/i.test(
      text,
    )
  )
    return true
  if (/\n\s*([-*•]|\d+[.)])/.test(text)) return true // list-like structure
  if ((text.match(/[.!?](\s|$)/g) ?? []).length >= 2) return true // multiple sentences
  return false
}

export interface Classification {
  minor: boolean
  // Why it was flagged — useful for tuning/telemetry-free debugging and for a
  // future "skipped because…" hint. null when the prompt is kept.
  reason: 'trivial' | 'short' | null
}

/** Classify a prompt for selective capture at the given strength. Pure; safe to
 *  call in the capture hot path. Conservative by design — only obvious
 *  throwaways are flagged at 'balanced'; 'strict' also drops short non-structured
 *  prompts; 'off' keeps everything. */
export function classifyPrompt(
  text: string,
  strength: FilterStrength = 'balanced',
): Classification {
  if (strength === 'off') return { minor: false, reason: null }
  const norm = normalize(text)
  if (!norm) return { minor: true, reason: 'short' }
  // Strip trailing punctuation so "yes." / "continue!" still match the list.
  const bare = norm.replace(/[.!?…]+$/, '').trim()
  if (TRIVIAL.has(bare)) return { minor: true, reason: 'trivial' }
  const words = bare ? bare.split(' ').length : 0
  if (norm.length <= SHORT_CHARS[strength] && words < RICH_WORDS[strength] && !hasSubstance(text)) {
    return { minor: true, reason: 'short' }
  }
  return { minor: false, reason: null }
}
