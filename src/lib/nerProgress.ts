// Aggregate Transformers.js hub download callbacks into one 0–1 progress.
// HF often omits Content-Length (chunked CDN) — then loaded===total every tick
// and naive loaded/total stays stuck at 100%. Prefer the per-file `progress`
// field (0–100) when it moves; fall back to a soft byte asymptote otherwise.

/** Soft size hint for q8 bert-base-NER + tokenizer when Content-Length missing. */
export const NER_DOWNLOAD_BYTE_HINT = 110 * 1024 * 1024

export type NerHubProgressItem = {
  status?: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}

export type NerProgressEmit = (progress: number) => void

/**
 * Returns a callback suitable for `pipeline(..., { progress_callback })`.
 * Progress is monotonic 0–0.99 until the caller marks ready.
 */
export function createNerProgressTracker(
  emit: NerProgressEmit,
  opts?: { byteHint?: number; minDelta?: number; minMs?: number },
): (item: NerHubProgressItem) => void {
  const byteHint = opts?.byteHint ?? NER_DOWNLOAD_BYTE_HINT
  const minDelta = opts?.minDelta ?? 0.005
  const minMs = opts?.minMs ?? 50

  /** Per-file fraction 0–1. */
  const filePct = new Map<string, number>()
  const fileLoaded = new Map<string, number>()
  /** Files whose Content-Length looks real (loaded < total at some point). */
  const knownLength = new Map<string, boolean>()

  let lastWritten = -1
  let lastAt = 0

  const flush = (force = false) => {
    const keys = [...filePct.keys()]
    if (keys.length === 0) return

    let sum = 0
    for (const k of keys) sum += filePct.get(k) ?? 0
    let p = sum / keys.length

    // If every active file looks "full" only because total grew with loaded,
    // prefer a global byte asymptote so the ring still moves.
    const allFakeFull =
      keys.length > 0 &&
      keys.every((k) => !knownLength.get(k) && (filePct.get(k) ?? 0) >= 0.9)
    if (allFakeFull) {
      let bytes = 0
      for (const b of fileLoaded.values()) bytes += b
      p = Math.min(0.95, 1 - 1 / (1 + bytes / Math.max(byteHint, 1)))
    }

    p = Math.min(0.99, Math.max(0, p))
    const now = Date.now()
    if (!force && p + 0.0001 < lastWritten) return
    if (!force && p - lastWritten < minDelta && now - lastAt < minMs && p < 0.99) return
    lastWritten = p
    lastAt = now
    emit(p)
  }

  return (item) => {
    const file =
      typeof item.file === 'string' && item.file
        ? item.file
        : typeof item.status === 'string'
          ? `_${item.status}`
          : '_unknown'

    if (item.status === 'initiate' || item.status === 'download') {
      if (!filePct.has(file)) {
        filePct.set(file, 0)
        lastWritten = -1
      }
      flush()
      return
    }

    if (item.status === 'progress') {
      const loaded = typeof item.loaded === 'number' ? item.loaded : 0
      const total = typeof item.total === 'number' ? item.total : 0
      if (loaded > 0) fileLoaded.set(file, Math.max(fileLoaded.get(file) ?? 0, loaded))

      let pct = filePct.get(file) ?? 0

      if (total > 0 && loaded < total) {
        knownLength.set(file, true)
        pct = loaded / total
      } else if (knownLength.get(file) && total > 0) {
        pct = Math.min(1, loaded / total)
      } else if (typeof item.progress === 'number' && !(total > 0 && loaded >= total && item.progress >= 99)) {
        // Normal HF progress 0–100 (or 0–1). Ignore the "always 100" unknown-length case.
        const raw = item.progress > 1 ? item.progress / 100 : item.progress
        pct = Math.min(0.99, Math.max(pct, raw))
      } else if (total > 0 && loaded >= total) {
        // Missing Content-Length: total expands with each chunk → always ~100%.
        knownLength.set(file, false)
        pct = Math.min(0.95, 1 - 1 / (1 + loaded / byteHint))
      }

      filePct.set(file, Math.max(filePct.get(file) ?? 0, pct))
      flush()
      return
    }

    if (item.status === 'done') {
      knownLength.set(file, true)
      filePct.set(file, 1)
      flush(true)
    }
  }
}
