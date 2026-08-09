// Background ↔ offscreen bridge for optional NER. Capture stays fail-open:
// if the model isn't ready or inference fails, structured regex redaction
// still runs and the prompt is saved.

import {
  collectStructuredHits,
  mergeHits,
  redactFromHits,
  redactPii,
  type RedactOptions,
  type RedactResult,
} from '@/lib/pii'
import { nerEntitiesToHits, type NerEntity } from '@/lib/nerPii'
import { toSafeNerError } from '@/lib/nerErrors'
import { readNerStatus, writeNerStatus } from '@/lib/nerStatus'
import type { PiiKind } from '@/lib/types'

const OFFSCREEN_PATH = 'src/offscreen/index.html'
const OFFSCREEN_JUSTIFICATION =
  'Run the optional on-device name/street helper (Transformers.js) outside the service worker'

async function hasOffscreen(): Promise<boolean> {
  try {
    if (chrome.offscreen?.hasDocument) return await chrome.offscreen.hasDocument()
  } catch {
    /* older Chrome */
  }
  return false
}

async function pingOffscreen(): Promise<boolean> {
  try {
    const resp = (await chrome.runtime.sendMessage({ type: 'NER_OFFSCREEN_PING' })) as
      | { ok?: boolean }
      | undefined
    return resp?.ok === true
  } catch {
    return false
  }
}

async function createOffscreen(): Promise<void> {
  const reason =
    chrome.offscreen?.Reason?.WORKERS ?? ('WORKERS' as chrome.offscreen.Reason)
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [reason],
    justification: OFFSCREEN_JUSTIFICATION,
  })
}

export async function ensureNerOffscreen(): Promise<void> {
  // Dead/stale offscreen (hasDocument but no ping) must be recreated — otherwise
  // we poll for a few seconds and fail forever on a zombie page.
  if (await hasOffscreen()) {
    if (await pingOffscreen()) return
    try {
      await chrome.offscreen.closeDocument()
    } catch {
      /* ignore */
    }
  }

  await createOffscreen()

  // First boot parses a large Transformers bundle — allow longer than a couple seconds.
  for (let i = 0; i < 100; i++) {
    if (await pingOffscreen()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Helper page did not become ready in time')
}

/** Start (or resume) downloading / loading the NER model. */
export async function loadNerModel(): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureNerOffscreen()
    const resp = (await chrome.runtime.sendMessage({ type: 'NER_OFFSCREEN_LOAD' })) as
      | { ok: boolean; error?: string; errorDetail?: string }
      | undefined
    if (!resp?.ok) {
      // Prefer offscreen's already-scrubbed status / response — never re-classify
      // a plain-language message into a second generic error (loses detail).
      const status = await readNerStatus()
      if (status.state === 'error' && status.error) {
        return { ok: false, error: status.error }
      }
      const message =
        typeof resp?.error === 'string' && resp.error
          ? resp.error
          : 'Something went wrong while getting the helper ready. Try again in a moment.'
      const errorDetail =
        typeof resp?.errorDetail === 'string' && resp.errorDetail
          ? resp.errorDetail
          : undefined
      await writeNerStatus(
        {
          state: 'error',
          progress: 0,
          error: message,
          errorDetail,
        },
        { resetProgress: true },
      )
      return { ok: false, error: message }
    }
    return { ok: true }
  } catch (err) {
    const safe = toSafeNerError(err)
    await writeNerStatus(
      {
        state: 'error',
        progress: 0,
        error: safe.message,
        errorDetail: safe.detail,
      },
      { resetProgress: true },
    )
    return { ok: false, error: safe.message }
  }
}

async function inferNerEntities(text: string): Promise<NerEntity[]> {
  await ensureNerOffscreen()
  const resp = (await chrome.runtime.sendMessage({
    type: 'NER_OFFSCREEN_INFER',
    text,
  })) as { ok?: boolean; entities?: NerEntity[] } | undefined
  if (!resp?.ok || !Array.isArray(resp.entities)) return []
  return resp.entities
}

export interface RedactFullOptions extends RedactOptions {
  /** Master opt-in from prefs. When false, NER never runs. */
  nerNamesPlaces?: boolean
}

/**
 * Structured regex first; optional NER for names / street-like places when the
 * model is ready. Never throws — falls back to structured-only on any failure.
 */
export async function redactPiiFull(
  input: string,
  enabled: Record<PiiKind, boolean> = {
    secret: true,
    email: true,
    card: true,
    iban: true,
    ssn: true,
    phone: true,
    ip: true,
    person: true,
    place: true,
    city: true,
  },
  options: RedactFullOptions = {},
): Promise<RedactResult> {
  if (!input) return redactPii(input, enabled, options)

  const wantsNer =
    options.nerNamesPlaces === true &&
    (enabled.person === true || enabled.place === true || enabled.city === true)

  if (!wantsNer) {
    return redactPii(input, enabled, options)
  }

  try {
    const status = await readNerStatus()
    if (status.state !== 'ready') {
      return redactPii(input, enabled, options)
    }

    const structured = collectStructuredHits(input, enabled)
    const entities = await inferNerEntities(input)
    const nerHits = nerEntitiesToHits(input, entities, {
      person: enabled.person,
      place: enabled.place,
      city: enabled.city,
    })
    return redactFromHits(input, mergeHits(structured, nerHits), options.existingVault)
  } catch {
    return redactPii(input, enabled, options)
  }
}
