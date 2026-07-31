// Selective capture — decide whether a captured prompt is worth storing, or is
// a throwaway "minor" prompt (a one-word follow-up, a bare "yes"/"continue", a
// tiny fragment) that would only clutter the library and add noise to resurface.
//
// PHILOSOPHY
//   - Skip storing, don't hide. A minor prompt is never written to IndexedDB.
//     Filter strength is a deliberate gate on what enters the library — not a
//     soft flag on rows that still take up space. Set strength to 'off' to save
//     everything. (Legacy soft-captured rows may still exist with `minor: true`;
//     the library can reveal those under "filtered".)
//   - The bar is deliberately CONSERVATIVE. At the default ('balanced') we skip
//     only exact conversational glue ("yes", "continue", …). The short/substance
//     gate is reserved for 'strict'. We'd rather keep a borderline prompt than
//     skip one the user wanted.
//   - "Hard to remember & reusable" is the real target, but reusability is not
//     detectable locally without a model (v1 ships zero LLM calls). So we proxy
//     it with what we CAN measure: triviality, length, and structural substance.
//   - Substance is judged in EVERYDAY terms, not just technical ones. A prompt
//     with a tone, an audience, a length, or a real question is as worth keeping
//     as one with a code fence — most people writing to an AI aren't writing code.
//   - Local, pure, zero-dependency, unit-testable. The constants are PROVISIONAL
//     and centralized here so tuning is a one-line change once we have real data.

import type { FilterStrength } from './types'

// Short / substance gate — used only at 'strict'. 'balanced' skips exact throwaways
// (and empty text) and keeps everything else, so the default matches what Settings
// promises: skip “yes” / “continue”, not “ideas for date night”.
const SHORT_CHARS = 60
const RICH_WORDS = 10

// Exact throwaway prompts: conversational glue that is never worth reusing.
// Matched against the WHOLE normalized text (sans trailing punctuation), never
// as a substring — so a bare "explain" is flagged while "explain the CAP
// theorem" is untouched. Lowercase; keep this list tight and obvious.
const TRIVIAL = new Set([
  // Affirm / deny / acknowledge
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
  'got it',
  'makes sense',
  'sounds good',
  'looks good',
  "that's fine",
  'thats fine',
  'all good',
  'done',
  'finished',
  // Thanks / praise
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
  'awesome',
  'amazing',
  'love it',
  'works',
  'working',
  // Keep going / try again
  'continue',
  'go on',
  'go ahead',
  'keep going',
  'proceed',
  'next',
  'more',
  'go',
  'do it',
  'send it',
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
  'try again',
  'one more',
  'another one',
  'fix it',
  'fix this',
  'undo',
  // Bare verbs that are follow-ups, not requests
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
  'longer',
  'shorter',
  'more detail',
  'less detail',
  'be brief',
  // Greetings / noise
  'hmm',
  'idk',
  'hi',
  'hello',
  'hey',
  'yo',
  'lol',
  'lmao',
  'same',
  'test',
  'testing',
])

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

// Words that signal a prompt was *composed* rather than fired off: the writer
// specified a tone, an audience, a format, a length, or a language. These are
// what a considered everyday request looks like ("write a polite note to my
// landlord", "explain gravity to a 6-year-old", "in 100 words, summarise this"),
// and they're the everyday counterpart to a code fence — a cheap, local signal
// that there was craft here worth keeping.
//
// Kept fairly specific on purpose. Bare words like "style", "include", or "for"
// alone would rescue half the short noise on the internet.
const LANG =
  'english|spanish|french|german|italian|portuguese|arabic|persian|farsi|chinese|japanese|korean|hindi|russian|turkish|dutch'
const CRAFT_CUES = new RegExp(
  String.raw`\b(as an?|act as|in the (style|tone|voice) of|formal|informal|casual|polite|friendly|professional|persuasive|concise|detailed|step by step|step-by-step|bullet points?|as a table|as (an? )?outline|rewrite|translate|summari[sz]e|explain|eli5|compare|pros and cons|for (a|an|my|our) |to (a|an|my|our) |for (kids|beginners)|so that|without|make sure|(in|to|into) (${LANG}))\b`,
  'i',
)

// Signals that even a short prompt carries reusable substance and should be
// kept. Any one of these rescues it from being skipped. Reads the RAW text so
// newline-based structure survives.
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
  if (/["“”'']{1}[^"“”'']{12,}["“”'']{1}/.test(text)) return true // quoted passage to work on
  // A quantity or limit — "5 ideas", "300 words", "two paragraphs". Real
  // constraints, and the kind of detail people don't want to retype.
  if (
    /\b\d+\s*(word|words|character|characters|sentence|sentences|paragraph|paragraphs|bullet|bullets|item|items|idea|ideas|line|lines|min|mins|minute|minutes|day|days)\b/i.test(
      text,
    )
  )
    return true
  // Spelled-out small counts people actually write: "two paragraphs", "five ideas".
  if (
    /\b(two|three|four|five|six|seven|eight|nine|ten)\s+(word|words|sentence|sentences|paragraph|paragraphs|bullet|bullets|idea|ideas|option|options|version|versions)\b/i.test(
      text,
    )
  )
    return true
  const words = text.trim().split(/\s+/).length
  // A genuine question, not a one-word "why?".
  if (/\?/.test(text) && words >= 4) return true
  // Craft cues are already specific; two words is enough ("ELI5 photosynthesis",
  // "translate to Spanish") — one-word bare cues like "formal" stay out.
  if (words >= 2 && CRAFT_CUES.test(text)) return true
  return false
}

export interface Classification {
  minor: boolean
  // Why it was skipped — useful for tuning/telemetry-free debugging and for a
  // future "skipped because…" hint. null when the prompt should be stored.
  reason: 'trivial' | 'short' | null
}

/** Classify a prompt for selective capture at the given strength. Pure; safe to
 *  call in the capture hot path. Conservative by design — 'balanced' skips only
 *  obvious throwaways; 'strict' also skips short non-structured prompts; 'off'
 *  keeps everything. */
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
  // Default: keep anything that isn't exact conversational glue.
  if (strength === 'balanced') return { minor: false, reason: null }
  const words = bare ? bare.split(' ').length : 0
  if (norm.length <= SHORT_CHARS && words < RICH_WORDS && !hasSubstance(text)) {
    return { minor: true, reason: 'short' }
  }
  return { minor: false, reason: null }
}
