import MiniSearch from 'minisearch'
import type { Prompt } from './types'

// Search has to work for someone who half-remembers what they asked. They typed
// "e-mail my landlord" three weeks ago and today they search "email landlord" —
// or "letter to landlord". Plain keyword matching finds neither.
//
// Two cheap layers close most of that gap, in order of confidence:
//   1. Normalisation (processTerm) — plurals and British/American spellings are
//      folded together at BOTH index and query time, so "summarise" and
//      "summaries" reach "summarize". This is safe enough to apply invisibly.
//   2. Expansion (searchPrompts) — everyday synonyms are searched as a SECOND
//      pass, and their hits are appended after the literal ones. Precision is
//      untouched: what you typed always ranks first; the synonyms only add
//      results that would otherwise not appear at all.
//
// What this deliberately is not: real semantic search. "compose verse about
// felines" will still not find "write a poem about cats" — only embeddings do
// that, and that's a ~20-30 MB model and a different conversation. This handles
// the vocabulary drift that shows up in ordinary use, for free and instantly.

// Spellings that should collapse to one form. Applied to single terms only.
const SPELLING: Record<string, string> = {
  summarise: 'summarize',
  organise: 'organize',
  apologise: 'apologize',
  realise: 'realize',
  recognise: 'recognize',
  personalise: 'personalize',
  colour: 'color',
  favourite: 'favorite',
  behaviour: 'behavior',
  honour: 'honor',
  humour: 'humor',
  neighbour: 'neighbor',
  centre: 'center',
  theatre: 'theater',
  travelling: 'traveling',
  cancelled: 'canceled',
  cv: 'resume',
  email: 'email',
  'e-mail': 'email',
}

/** Fold a term to its canonical form: lowercase, known spelling variants
 *  unified, simple plurals stripped. Runs at index and query time both, so the
 *  two always agree. */
export function normalizeTerm(term: string): string {
  const t = term.toLowerCase()
  const spelled = SPELLING[t]
  if (spelled) return spelled
  // Plurals only — the safe end of stemming. Verb endings ("-ing", "-ed") are
  // left alone: stripping them turns "meeting" into "meet" and "editing" into
  // "edit", which changes what the word means to the person searching.
  if (t.length > 3 && t.endsWith('ies')) return `${t.slice(0, -3)}y`
  if (t.length > 3 && t.endsWith('es') && /(ch|sh|ss|x|z)es$/.test(t)) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1)
  return t
}

// Everyday word groups. Every term in a group can find every other term.
// Written for how people actually talk about their own chats — kept short,
// because a loose synonym list makes search feel random rather than smart.
const SYNONYM_GROUPS: string[][] = [
  ['email', 'mail', 'message', 'note', 'letter', 'reply'],
  ['write', 'draft', 'compose', 'create'],
  ['summarize', 'summary', 'recap', 'tldr', 'condense', 'shorten'],
  ['explain', 'explanation', 'describe', 'teach', 'clarify', 'understand'],
  ['fix', 'correct', 'repair', 'improve', 'polish'],
  ['translate', 'translation'],
  ['resume', 'cover', 'job', 'career', 'application', 'interview', 'hiring'],
  ['boss', 'manager', 'colleague', 'coworker', 'team'],
  ['money', 'budget', 'cost', 'price', 'finance', 'salary'],
  ['trip', 'travel', 'holiday', 'vacation', 'flight', 'itinerary'],
  ['food', 'meal', 'recipe', 'dinner', 'lunch', 'cooking'],
  ['kid', 'child', 'son', 'daughter', 'family'],
  ['study', 'learn', 'course', 'lesson', 'revision', 'exam'],
  ['workout', 'exercise', 'fitness', 'training', 'gym'],
  ['post', 'caption', 'tweet', 'newsletter', 'blog'],
  ['photo', 'picture', 'image'],
  ['idea', 'brainstorm', 'suggestion', 'inspiration'],
  ['plan', 'schedule', 'agenda', 'checklist'],
  ['funny', 'humor', 'joke', 'witty'],
  ['health', 'doctor', 'medical', 'symptom'],
  ['landlord', 'rent', 'lease', 'tenant', 'apartment'],
]

// term → the other terms in its group, precomputed once at module load.
const SYNONYMS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>()
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      const key = normalizeTerm(term)
      const others = group.filter((t) => t !== term).map(normalizeTerm)
      map.set(key, [...(map.get(key) ?? []), ...others])
    }
  }
  return map
})()

/** The extra terms worth searching for alongside what was typed — empty when
 *  none of the query's words have everyday synonyms. */
export function expandQuery(query: string): string {
  const typed = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9'-]+/i)
      .filter(Boolean)
      .map(normalizeTerm),
  )
  const extra = new Set<string>()
  for (const term of typed) {
    for (const syn of SYNONYMS.get(term) ?? []) {
      if (!typed.has(syn)) extra.add(syn)
    }
  }
  return [...extra].join(' ')
}

export function buildIndex(prompts: Prompt[]): MiniSearch<Prompt> {
  const ms = new MiniSearch<Prompt>({
    fields: ['text', 'platform'],
    storeFields: ['id', 'text', 'platform', 'createdAt', 'usageCount', 'lastUsedAt'],
    idField: 'id',
    processTerm: (term) => normalizeTerm(term),
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { text: 2 } },
  })
  ms.addAll(prompts.filter((p) => p.id != null))
  return ms
}

export function searchPrompts(index: MiniSearch<Prompt>, query: string, limit = 50) {
  if (!query.trim()) return []
  const literal = index.search(query)
  if (literal.length >= limit) return literal.slice(0, limit)

  const expansion = expandQuery(query)
  if (!expansion) return literal.slice(0, limit)

  // Synonym hits are appended, never interleaved: a prompt containing the words
  // you actually typed should always outrank one that merely means the same.
  const seen = new Set(literal.map((h) => h.id))
  const related = index.search(expansion).filter((h) => !seen.has(h.id))
  return [...literal, ...related].slice(0, limit)
}
