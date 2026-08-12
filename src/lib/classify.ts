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
//     only conversational glue ("yes", "ok thanks", "👍"). The short/substance
//     gate is reserved for 'strict'. We'd rather keep a borderline prompt than
//     skip one the user wanted.
//   - Glue is recognised two ways, because one is not enough. A phrase list
//     (TRIVIAL) catches fixed sayings with content words in them ("makes sense",
//     "try again"); an all-filler rule catches the open-ended combinations a
//     list can never hold ("ok thanks", "yes please", "thank you so much").
//   - "Hard to remember & reusable" is the real target, but reusability is not
//     detectable locally without a model (v1 ships zero LLM calls). So we proxy
//     it with what we CAN measure: triviality, length, and structural substance.
//   - Substance is judged in EVERYDAY terms, not just technical ones. A prompt
//     with a tone, an audience, a length, or a real question is as worth keeping
//     as one with a code fence — most people writing to an AI aren't writing code.
//   - Local, pure, zero-dependency, unit-testable. The constants are PROVISIONAL
//     and centralized here so tuning is a one-line change once we have real data.

import type { FilterStrength } from './types'

// Short / substance gate — used only at 'strict'. 'balanced' skips throwaways
// (glue, decoration-only, empty text) and keeps everything else, so the default
// matches what Settings promises: skip “yes” / “continue”, not “ideas for date
// night”.
//
// Both bars must be cleared to be skipped: a prompt is only "short" if it is
// under SHORT_CHARS *and* under RICH_WORDS. The word bar is the narrower of the
// two — clearing it inside 60 characters means many small words ("can you tell
// me how to word this politely for work"), which reads as composed even though
// it is brief, so it is kept.
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
  'no worries',
  'no problem',
  'np',
  'my bad',
  'never mind',
  'nevermind',
  'forget it',
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

// Fold the characters a phone or macOS autocorrect substitutes silently, so the
// list above (written with straight quotes) still matches what people actually
// type. Without this, “that’s fine” — the form every Apple keyboard produces —
// misses the entry sitting right there in TRIVIAL.
function normalize(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Punctuation, symbols and emoji at either end. Stripped only for the throwaway
// check — the stored text keeps every character. Covers “…yes!!”, “ok 👍”,
// “«continue»”, none of which the old trailing-`[.!?…]` strip caught.
const EDGE_DECORATION = /^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu

// Elongation is emphasis, not content: “yesss”, “okkkk”, “thanksss”. Collapse a
// run of 3+ of the same letter to one so it matches the plain form. English has
// no word with a real triple letter, so this can't damage a genuine prompt.
const ELONGATED = /(\p{L})\1{2,}/gu

function bareForm(norm: string): string {
  return norm.replace(EDGE_DECORATION, '').replace(ELONGATED, '$1')
}

// Words that carry no request on their own. A message built only from these is
// glue however it's combined — “ok thanks”, “yes please”, “thank you so much”,
// “got it, cool” — and a fixed phrase list can never enumerate the combinations.
// Every entry must be meaningless in isolation; anything that could carry a real
// ask (write, plan, email, fix) stays out.
const FILLER = new Set([
  'a',
  'ah',
  'all',
  'alright',
  'am',
  'amazing',
  'and',
  'awesome',
  'be',
  'brilliant',
  'but',
  'cheers',
  'cool',
  'do',
  'done',
  'eh',
  'fine',
  'for',
  'good',
  'got',
  'great',
  'hello',
  'hey',
  'hi',
  'hm',
  'hmm',
  'how',
  'huh',
  'i',
  'is',
  'it',
  'its',
  "it's",
  'k',
  'kk',
  'lovely',
  'love',
  'lol',
  'man',
  'me',
  'much',
  'my',
  'n',
  'nah',
  'nice',
  'no',
  'nope',
  'now',
  'oh',
  'ok',
  'okay',
  'perfect',
  'please',
  'pls',
  'plz',
  'really',
  'right',
  'sense',
  'so',
  'sorry',
  'sounds',
  'sure',
  'thank',
  'thanks',
  'that',
  "that's",
  'thats',
  'the',
  'then',
  'this',
  'thx',
  'ty',
  'uh',
  'um',
  'very',
  'wait',
  'was',
  'well',
  'what',
  'why',
  'works',
  'wow',
  'y',
  'ya',
  'yay',
  'yeah',
  'yep',
  'yes',
  'you',
  'yup',
])

// Laughter and stretched agreement don't fit in a word list ("hahaha", "loool",
// "hehe") — they're generated, not enumerated.
const LAUGHTER = /^(?:(?:ha|he|hi|ja|ho){2,}|l+o+l+z*|r+o+f+l+|lmf?ao+)$/

const MAX_FILLER_WORDS = 6

function isFillerWord(word: string): boolean {
  return FILLER.has(word) || LAUGHTER.test(word)
}

// True when every word is filler. Length-capped: past a handful of words the
// odds tip toward a real sentence that happens to use small words, and we would
// rather keep a borderline prompt than drop one.
function isAllFiller(bare: string): boolean {
  const words = bare.match(/[\p{L}\p{N}']+/gu)
  if (!words || words.length === 0 || words.length > MAX_FILLER_WORDS) return false
  return words.every(isFillerWord)
}

/** True when nothing is left after punctuation, symbols and emoji — “👍”, “???”,
 *  “🙏🏽🙏🏽”. There is no prompt here to remember. */
function hasNoWords(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text)
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
// Output shapes people ask for by name. "put it in a table", "as a checklist",
// "in markdown" — a named format is a specification, the same kind of signal a
// named tone is, and it was the most common everyday cue the tone/audience list
// missed.
const FORMATS =
  'table|list|checklist|outline|bullet points?|markdown|json|csv|email|essay|poem|tweet|thread|script|recipe|itinerary|summary|paragraphs?'
const CRAFT_CUES = new RegExp(
  String.raw`\b(as an?|act as|in the (style|tone|voice) of|formal|informal|casual|polite|friendly|professional|persuasive|concise|detailed|step by step|step-by-step|bullet points?|(in|as|into) (an? )?(${FORMATS})|rewrite|translate|summari[sz]e|explain|eli5|compare|pros and cons|for (a|an|my|our) |to (a|an|my|our) |for (kids|beginners)|so that|without|make sure|(in|to|into) (${LANG}))\b`,
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
  const norm = normalize(text)
  // Empty is skipped at EVERY strength, 'off' included: "save everything" means
  // every message, and there is no message here to save.
  if (!norm) return { minor: true, reason: 'short' }
  if (strength === 'off') return { minor: false, reason: null }
  // Strip edge punctuation/emoji and elongation so "yes." / "continue!!" /
  // "okkkk 👍" all match the list.
  const bare = bareForm(norm)
  if (hasNoWords(bare)) return { minor: true, reason: 'trivial' }
  if (TRIVIAL.has(bare)) return { minor: true, reason: 'trivial' }
  if (isAllFiller(bare)) return { minor: true, reason: 'trivial' }
  // Default: keep anything that isn't conversational glue.
  if (strength === 'balanced') return { minor: false, reason: null }
  const words = bare ? bare.split(' ').length : 0
  if (norm.length <= SHORT_CHARS && words < RICH_WORDS && !hasSubstance(text)) {
    return { minor: true, reason: 'short' }
  }
  return { minor: false, reason: null }
}
