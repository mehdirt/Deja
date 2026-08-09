// Download / ready state for the optional on-device NER helper. Separate from
// prefs so progress ticks during download don't fight writePrefs merging.
// Prompt text never lives here — only status. Error fields are safe/scrubbed
// (see nerErrors.ts); never store raw exception dumps.

import { NER_MODEL_ID } from './nerPii'

const KEY = 'nerStatus'

export type NerState = 'off' | 'downloading' | 'ready' | 'error'

export interface NerStatus {
  state: NerState
  /** 0–1 while downloading; ignored otherwise. */
  progress: number
  /** Plain-language error for Settings (never a raw stack / signed URL). */
  error?: string
  /** Optional scrubbed technical detail for “What went wrong?”. */
  errorDetail?: string
  modelId: string
}

export const DEFAULT_NER_STATUS: NerStatus = {
  state: 'off',
  progress: 0,
  modelId: NER_MODEL_ID,
}

function coerce(raw: unknown): NerStatus {
  const obj = (raw ?? {}) as Partial<NerStatus>
  const state: NerState =
    obj.state === 'downloading' || obj.state === 'ready' || obj.state === 'error' || obj.state === 'off'
      ? obj.state
      : 'off'
  const progress =
    typeof obj.progress === 'number' && Number.isFinite(obj.progress)
      ? Math.min(1, Math.max(0, obj.progress))
      : 0
  return {
    state,
    progress,
    error: typeof obj.error === 'string' && obj.error ? obj.error.slice(0, 200) : undefined,
    errorDetail:
      typeof obj.errorDetail === 'string' && obj.errorDetail
        ? obj.errorDetail.slice(0, 280)
        : undefined,
    modelId: typeof obj.modelId === 'string' && obj.modelId ? obj.modelId : NER_MODEL_ID,
  }
}

export async function readNerStatus(): Promise<NerStatus> {
  try {
    const res = await chrome.storage.local.get(KEY)
    return coerce(res?.[KEY])
  } catch {
    return { ...DEFAULT_NER_STATUS }
  }
}

export async function writeNerStatus(
  patch: Partial<NerStatus>,
  opts?: { /** Allow progress to drop (new download / retry). */ resetProgress?: boolean },
): Promise<NerStatus> {
  const current = await readNerStatus()
  // Settings may fire `progress: 0` while the offscreen tracker already advanced —
  // never let a stale download write move the ring backwards.
  const merged: Partial<NerStatus> = { ...patch }
  if (
    !opts?.resetProgress &&
    current.state === 'downloading' &&
    (merged.state === 'downloading' || merged.state === undefined) &&
    typeof merged.progress === 'number' &&
    merged.progress + 0.0001 < current.progress
  ) {
    merged.progress = current.progress
  }
  const next = coerce({ ...current, ...merged })
  try {
    await chrome.storage.local.set({ [KEY]: next })
  } catch {
    /* never throw into capture */
  }
  return next
}

export function onNerStatusChange(cb: (status: NerStatus) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) cb(coerce(changes[KEY].newValue))
  }
  try {
    chrome.storage.onChanged.addListener(listener)
  } catch {
    return () => {}
  }
  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener)
    } catch {
      /* ignore */
    }
  }
}
