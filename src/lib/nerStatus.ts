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

/** In-process peak so rapid offscreen ticks don't regress via read/write races. */
let peakDownloadProgress = 0

// Serialize RMW within one context. Concurrent `void writeNerStatus(...)` from
// progress ticks otherwise let an older write land after a newer one and snap
// storage (and the Settings ring) back to 0%.
let writeChain: Promise<void> = Promise.resolve()

export function writeNerStatus(
  patch: Partial<NerStatus>,
  opts?: { /** Allow progress to drop (new download / retry). */ resetProgress?: boolean },
): Promise<NerStatus> {
  const done = writeChain.catch(() => {}).then(async () => {
    const current = await readNerStatus()
    // Settings may fire `progress: 0` while the offscreen tracker already advanced —
    // never let a stale download write move the ring backwards.
    const merged: Partial<NerStatus> = { ...patch }
    if (opts?.resetProgress) {
      peakDownloadProgress = typeof merged.progress === 'number' ? merged.progress : 0
    }
    if (
      !opts?.resetProgress &&
      (merged.state === 'downloading' || current.state === 'downloading') &&
      typeof merged.progress === 'number'
    ) {
      peakDownloadProgress = Math.max(peakDownloadProgress, current.progress, merged.progress)
      merged.progress = peakDownloadProgress
    }
    if (merged.state === 'ready') peakDownloadProgress = 1
    if (merged.state === 'error' || merged.state === 'off') {
      if (opts?.resetProgress || merged.state === 'off') peakDownloadProgress = 0
    }
    const next = coerce({ ...current, ...merged })
    try {
      await chrome.storage.local.set({ [KEY]: next })
    } catch {
      /* never throw into capture */
    }
    return next
  })
  writeChain = done.then(() => {}).catch(() => {})
  return done
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

/**
 * Merge a status update into UI state without snapping a live download back to
 * the indeterminate 0% spinner. Pass `reset: true` for an intentional restart.
 */
export function mergeNerStatusUi(
  prev: NerStatus,
  next: NerStatus,
  opts?: { reset?: boolean },
): NerStatus {
  if (opts?.reset) return next
  if (next.state === 'ready' || next.state === 'error' || next.state === 'off') return next
  if (next.state === 'downloading' && prev.state === 'downloading') {
    return { ...next, progress: Math.max(prev.progress, next.progress) }
  }
  return next
}
