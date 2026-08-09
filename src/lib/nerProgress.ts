// Aggregate Transformers.js hub download callbacks into one 0–1 progress.
// HF often omits Content-Length (chunked CDN) — then loaded===total every tick
// and naive loaded/total stays stuck at 100%. We detect that and use a soft
// byte budget so the Settings ring can actually fill.

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

type FileProg = {
  loaded: number
  /** Declared Content-Length when known; else 0. */
  total: number
  known: boolean
  done: boolean
}

function overallProgress(files: Map<string, FileProg>, byteHint: number): number {
  if (files.size === 0) return 0

  let knownLoaded = 0
  let knownTotal = 0
  let unknownLoaded = 0
  let unknownFiles = 0

  for (const f of files.values()) {
    if (f.done) {
      const t = f.total > 0 ? f.total : Math.max(f.loaded, 1)
      knownLoaded += t
      knownTotal += t
      continue
    }
    if (f.known && f.total > 0) {
      knownLoaded += Math.min(f.loaded, f.total)
      knownTotal += f.total
    } else {
      unknownFiles += 1
      unknownLoaded += f.loaded
    }
  }

  if (unknownFiles === 0) {
    if (knownTotal <= 0) return 0
    return Math.min(0.99, knownLoaded / knownTotal)
  }

  // Budget each unknown file at byteHint so the ring moves as bytes arrive.
  const unknownTotal = unknownFiles * byteHint
  const loaded = knownLoaded + Math.min(unknownLoaded, unknownTotal * 0.95)
  const total = knownTotal + unknownTotal
  if (total <= 0) return 0
  return Math.min(0.99, loaded / total)
}

/**
 * Returns a callback suitable for `pipeline(..., { progress_callback })`.
 * Progress is monotonic 0–0.99 until the caller marks ready.
 */
export function createNerProgressTracker(
  emit: NerProgressEmit,
  opts?: { byteHint?: number; minDelta?: number; minMs?: number },
): (item: NerHubProgressItem) => void {
  const byteHint = opts?.byteHint ?? NER_DOWNLOAD_BYTE_HINT
  const minDelta = opts?.minDelta ?? 0.01
  const minMs = opts?.minMs ?? 80

  const files = new Map<string, FileProg>()
  let lastWritten = -1
  let lastAt = 0

  const flush = (force = false) => {
    const p = overallProgress(files, byteHint)
    const now = Date.now()
    if (!force && p + 0.0001 < lastWritten) return
    if (!force && p - lastWritten < minDelta && now - lastAt < minMs && p < 0.99) return
    lastWritten = p
    lastAt = now
    emit(p)
  }

  const ensure = (file: string): FileProg => {
    let f = files.get(file)
    if (!f) {
      f = { loaded: 0, total: 0, known: false, done: false }
      files.set(file, f)
    }
    return f
  }

  return (item) => {
    const file =
      typeof item.file === 'string' && item.file
        ? item.file
        : typeof item.status === 'string'
          ? `_${item.status}`
          : '_unknown'

    if (item.status === 'initiate' || item.status === 'download') {
      const existed = files.has(file)
      ensure(file)
      // New file expands the denominator — allow the aggregate to drop so later
      // bytes can move the ring again (instead of sticking at ~100%).
      if (!existed) lastWritten = -1
      flush()
      return
    }

    if (item.status === 'progress') {
      const f = ensure(file)
      if (f.done) return

      const loaded = typeof item.loaded === 'number' ? item.loaded : 0
      const total = typeof item.total === 'number' ? item.total : 0
      f.loaded = Math.max(f.loaded, loaded)

      if (total > 0 && loaded < total) {
        f.known = true
        f.total = total
      } else if (f.known && total > 0) {
        f.total = Math.max(f.total, total)
      } else if (total > 0 && loaded >= total && !f.known) {
        // Missing Content-Length: total expands with each chunk.
        f.known = false
        f.total = 0
      } else if (!f.known && typeof item.progress === 'number' && total <= 0) {
        const raw = item.progress > 1 ? item.progress / 100 : item.progress
        f.loaded = Math.max(f.loaded, raw * byteHint)
      }
      flush()
      return
    }

    if (item.status === 'done') {
      const f = ensure(file)
      f.done = true
      if (f.total <= 0) f.total = Math.max(f.loaded, 1)
      f.loaded = f.total
      f.known = true
      flush(true)
    }
  }
}
