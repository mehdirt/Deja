// Pure NER → PII hit conversion. The model runs elsewhere (offscreen); this
// file only decides which spans become [person_N] / [place_N] / [city_N].
// Tuned for low false positives: high confidence; PERSON; street-like LOC as
// place; other LOC/GPE as city when that category is enabled.

import type { Hit } from './pii'
import type { PiiKind } from './types'

/** Model id used by the offscreen runner (Transformers.js / Xenova ONNX). */
export const NER_MODEL_ID = 'Xenova/bert-base-NER'

/** Only redact when the model is at least this sure (0–1). */
export const NER_CONFIDENCE = 0.8

/** Rough first-download size shown in Settings (ONNX weights from Hugging Face). */
export const NER_SIZE_HINT = 'about 100 MB'

export type NerEntity = {
  /** Aggregated label, e.g. "PER" / "LOC" (aggregation_strategy: 'simple'). */
  entity_group?: string
  /** Per-token label when not aggregated, e.g. "B-PER". */
  entity?: string
  score: number
  word: string
  start?: number
  end?: number
}

const STREET_TYPE =
  /\b(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|way|pl|place|ter|terrace|hwy|highway|pkwy|parkway)\b/i

/** True when a LOC span looks like a street line, not a bare city/country. */
export function isStreetLikePlace(value: string): boolean {
  const v = value.trim()
  if (v.length < 5 || v.length > 80) return false
  // Need a house/unit number somewhere — "12 Oak St", "Apt 4B 100 Main Road".
  if (!/\d/.test(v)) return false
  if (STREET_TYPE.test(v)) return true
  // "123 Main" without a type word — still street-ish if short.
  return /^\d{1,6}\s+[A-Za-z]/.test(v) && v.split(/\s+/).length <= 6
}

/** Bare geo names (cities, countries, regions) — not street lines. */
export function looksLikeCityOrCountry(value: string): boolean {
  const v = value.trim()
  if (v.length < 2 || v.length > 60) return false
  if (isStreetLikePlace(v)) return false
  if (!/[A-Za-z]/.test(v)) return false
  // Too many tokens → likely a sentence fragment, not a place name.
  if (v.split(/\s+/).length > 5) return false
  return true
}

function normalizeLabel(entity: NerEntity): 'PER' | 'LOC' | null {
  const raw = (entity.entity_group ?? entity.entity ?? '').toUpperCase()
  const base = raw.replace(/^[BI]-/, '')
  if (base === 'PER' || base === 'PERSON') return 'PER'
  if (base === 'LOC' || base === 'LOCATION' || base === 'GPE') return 'LOC'
  return null
}

function looksLikePersonName(value: string): boolean {
  const v = value.trim()
  if (v.length < 2 || v.length > 60) return false
  // Drop single-letter / punctuation crumbs from tokenizer glue.
  if (!/[A-Za-z]/.test(v)) return false
  // All-caps short tokens are often acronyms (NASA), not people.
  if (v.length <= 4 && v === v.toUpperCase() && /^[A-Z]+$/.test(v)) return false
  return true
}

/**
 * Map raw NER entities to non-overlapping Hit spans for merge with structured
 * regex hits. Entities without character offsets are skipped (fail closed).
 */
export function nerEntitiesToHits(
  text: string,
  entities: NerEntity[],
  enabled: Pick<Record<PiiKind, boolean>, 'person' | 'place' | 'city'>,
): Hit[] {
  if (!text || entities.length === 0) return []
  const hits: Hit[] = []

  for (const ent of entities) {
    if (typeof ent.score !== 'number' || ent.score < NER_CONFIDENCE) continue
    if (typeof ent.start !== 'number' || typeof ent.end !== 'number') continue
    if (ent.end <= ent.start || ent.start < 0 || ent.end > text.length) continue

    const label = normalizeLabel(ent)
    if (!label) continue

    const value = text.slice(ent.start, ent.end)
    if (!value.trim()) continue

    if (label === 'PER') {
      if (!enabled.person) continue
      if (!looksLikePersonName(value)) continue
      hits.push({ start: ent.start, end: ent.end, kind: 'person', value })
      continue
    }

    if (label === 'LOC') {
      if (isStreetLikePlace(value)) {
        if (!enabled.place) continue
        hits.push({ start: ent.start, end: ent.end, kind: 'place', value })
        continue
      }
      if (!enabled.city) continue
      if (!looksLikeCityOrCountry(value)) continue
      hits.push({ start: ent.start, end: ent.end, kind: 'city', value })
    }
  }

  hits.sort((a, b) => a.start - b.start)
  return hits
}
